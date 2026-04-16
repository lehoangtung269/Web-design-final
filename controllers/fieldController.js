const Field = require('../models/Field');
const TimeSlot = require('../models/TimeSlot');

// ================================
// GET /fields — Danh sách tất cả sân đang hoạt động
// ================================
const getFieldList = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { status: 'active' };

    if (type && type !== 'all') {
      filter.type = type;
    }

    const fields = await Field.find(filter).sort({ createdAt: -1 });

    res.render('fields/list', {
      title: 'Danh sách sân bóng',
      activeNav: 'fields',
      fields,
      searchParams: { type: type || 'all' },
    });
  } catch (error) {
    console.error('Field List Error:', error);
    req.flash('error', 'Lỗi khi tải danh sách sân!');
    res.render('fields/list', {
      title: 'Danh sách sân bóng',
      activeNav: 'fields',
      fields: [],
      searchParams: {},
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

    const field = await Field.findById(id);
    if (!field) {
      req.flash('error', 'Không tìm thấy sân!');
      return res.redirect('/fields');
    }

    // Ngày mặc định = hôm nay
    const selectedDate = date ? new Date(date) : new Date();
    selectedDate.setHours(0, 0, 0, 0);

    // Tự động tạo slots nếu chưa có
    const slots = await TimeSlot.generateSlotsForDate(id, selectedDate);

    // Sắp xếp theo giờ bắt đầu
    const sortedSlots = slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    res.render('fields/detail', {
      title: field.name,
      activeNav: 'fields',
      field,
      slots: sortedSlots,
      selectedDate: selectedDate.toISOString().split('T')[0],
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

    const field = await Field.findById(id);
    if (!field) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sân!' });
    }

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    // Tạo slots nếu chưa có
    const slots = await TimeSlot.generateSlotsForDate(id, selectedDate);
    const sortedSlots = slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

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
