const Field = require('../models/Field');
const Booking = require('../models/Booking');
const TimeSlot = require('../models/TimeSlot');
const { escapeRegex } = require('../utils/escapeRegex');
const { buildApprovedFieldFilter } = require('../utils/fieldApproval');

const normalizeSearchParams = (query = {}) => ({
  date: query.date || '',
  time: query.time || '',
  type: query.type || 'all',
  keyword: query.keyword ? query.keyword.trim() : '',
  city: query.city || 'all',
  district: query.district || 'all',
});

const getResultMeta = (fields, searchParams) => {
  const prices = fields.map((item) => item.pricePerSlot).filter((price) => Number.isFinite(price));
  const cityCount = new Set(fields.map((item) => item.city).filter(Boolean)).size;
  const activeFilterCount = [
    searchParams.keyword,
    searchParams.date,
    searchParams.time,
    searchParams.type !== 'all' ? searchParams.type : '',
    searchParams.city !== 'all' ? searchParams.city : '',
    searchParams.district !== 'all' ? searchParams.district : '',
  ].filter(Boolean).length;

  return {
    total: fields.length,
    cityCount,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    activeFilterCount,
  };
};

// Helper: Parse 'YYYY-MM-DD' string as LOCAL midnight (not UTC)
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight
}

// Helper: Format date to 'YYYY-MM-DD' in local timezone
function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ================================
// GET /fields — Danh sách tất cả sân đang hoạt động
// ================================
const getFieldList = async (req, res) => {
  try {
    const searchParams = normalizeSearchParams(req.query);
    const { type, city, district, keyword } = searchParams;
    const filter = { status: 'active' };

    if (type && type !== 'all') {
      filter.type = type;
    }
    if (city && city !== 'all') {
      filter.city = city;
    }
    if (district && district !== 'all') {
      filter.district = district;
    }
    if (keyword) {
      const safeKeyword = escapeRegex(keyword);
      filter.$or = [
        { name: { $regex: safeKeyword, $options: 'i' } },
        { address: { $regex: safeKeyword, $options: 'i' } },
      ];
    }

    const approvedFilter = buildApprovedFieldFilter(filter);

    const [fields, cityAgg, districtAgg] = await Promise.all([
      Field.find(approvedFilter).sort({ createdAt: -1 }),
      Field.distinct('city', buildApprovedFieldFilter({ status: 'active' })),
      Field.distinct('district', buildApprovedFieldFilter({ status: 'active' })),
    ]);

    const resultMeta = getResultMeta(fields, searchParams);

    // Aggregate booking counts for field cards (#14)
    const fieldIds = fields.map(f => f._id);
    const bookingCounts = await Booking.aggregate([
      { $match: { field: { $in: fieldIds }, status: { $in: ['pending', 'confirmed'] } } },
      { $group: { _id: '$field', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    bookingCounts.forEach(bc => { countMap[bc._id.toString()] = bc.count; });
    fields.forEach(f => { f.bookingCount = countMap[f._id.toString()] || 0; });

    res.render('fields/list', {
      title: 'Danh sách sân bóng',
      activeNav: 'fields',
      viewMode: 'directory',
      fields,
      cities: cityAgg.filter(Boolean).sort(),
      districts: districtAgg.filter(Boolean).sort(),
      searchParams,
      resultMeta,
    });
  } catch (error) {
    console.error('Field List Error:', error);
    req.flash('error', 'Lỗi khi tải danh sách sân!');
    const searchParams = normalizeSearchParams(req.query);
    res.render('fields/list', {
      title: 'Danh sách sân bóng',
      activeNav: 'fields',
      viewMode: 'directory',
      fields: [],
      cities: [],
      districts: [],
      searchParams,
      resultMeta: getResultMeta([], searchParams),
    });
  }
};

// ================================
// GET /fields/:id — Chi tiết sân + bảng timeslot
// ================================
const getFieldDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    const field = await Field.findOne(buildApprovedFieldFilter({ _id: id, status: { $ne: 'deleted' } }));
    if (!field) {
      req.flash('error', 'Không tìm thấy sân!');
      return res.redirect('/fields');
    }

    // Chuyển đối current "now" cho múi giờ Việt Nam
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
    const nowVN = new Date(nowStr);

    // Ngày định dạng lấy theo VN Time
    let selectedDate = date ? parseLocalDate(date) : new Date(nowVN.getFullYear(), nowVN.getMonth(), nowVN.getDate());
    selectedDate.setHours(0, 0, 0, 0);

    // Chặn xem ngày quá khứ — clamp về hôm nay (theo VN Time)
    const today = new Date(nowVN.getFullYear(), nowVN.getMonth(), nowVN.getDate());
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      selectedDate = today;
    }

    // Tự động tạo slots nếu chưa có
    const slots = await TimeSlot.generateSlotsForDate(id, selectedDate);

    // Sắp xếp theo giờ bắt đầu
    let sortedSlots = slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Lọc bỏ các slot đã hết giờ (nếu đang xem hôm nay, dùng nowVN)
    const todayStart = today;
    const selectedDateStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    if (selectedDateStart.getTime() === todayStart.getTime()) {
      sortedSlots = sortedSlots.filter(slot => {
        const [endHours, endMinutes] = slot.endTime.split(':').map(Number);
        const slotEndDate = new Date(nowVN);
        slotEndDate.setHours(endHours, endMinutes, 0, 0);
        return slotEndDate > nowVN; // Chỉ giữ slot có giờ kết thúc > thời gian hiện tại ở VN
      });
    }

    res.render('fields/detail', {
      title: field.name,
      activeNav: 'fields',
      field,
      slots: sortedSlots,
      selectedDate: toLocalDateString(selectedDate),
    });
  } catch (error) {
    console.error('Field Detail Error:', error);
    req.flash('error', 'Lỗi khi tải chi tiết sân!');
    res.redirect('/fields');
  }
};

// ================================
// GET /fields/:id/slots?date=YYYY-MM-DD — API trả JSON slots
// Dùng cho AJAX khi user đổi ngày trên giao diện
// ================================
const getSlotsByDate = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số ngày!' });
    }

    const field = await Field.findOne(buildApprovedFieldFilter({ _id: id, status: { $ne: 'deleted' } }));
    if (!field) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sân!' });
    }

    const selectedDate = parseLocalDate(date);

    // Chuyển đổi timezone cho VN
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
    const nowVN = new Date(nowStr);

    const today = new Date(nowVN.getFullYear(), nowVN.getMonth(), nowVN.getDate());
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return res.status(400).json({ success: false, message: 'Không thể xem hoặc đặt sân trong quá khứ!' });
    }

    // Tạo slots nếu chưa có
    const slots = await TimeSlot.generateSlotsForDate(id, selectedDate);
    let sortedSlots = slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Lọc bỏ các slot đã hết giờ (nếu đang xem hôm nay)
    const todayStart = today;
    const selectedDateStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    if (selectedDateStart.getTime() === todayStart.getTime()) {
      sortedSlots = sortedSlots.filter(slot => {
        const [endHours, endMinutes] = slot.endTime.split(':').map(Number);
        const slotEndDate = new Date(nowVN);
        slotEndDate.setHours(endHours, endMinutes, 0, 0);
        return slotEndDate > nowVN; // Chỉ giữ slot có giờ kết thúc > thời gian hiện tại ở VN
      });
    }

    res.json({
      success: true,
      data: sortedSlots.map((slot) => ({
        _id: slot._id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
      })),
    });
  } catch (error) {
    console.error('Get Slots Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server!' });
  }
};

module.exports = { getFieldList, getFieldDetail, getSlotsByDate };
