const mongoose = require('mongoose');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Field = require('../models/Field');
const TimeSlot = require('../models/TimeSlot');
const { sendBookingConfirmationAsync } = require('../utils/emailService');
const {
  APPROVAL_STATUS,
  APPROVED_OR_LEGACY_CLAUSE,
  getEffectiveApprovalStatus,
} = require('../utils/fieldApproval');

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

function getDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getStartOfWeek(date = new Date()) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const dayOfWeek = target.getDay();
  const diffToMonday = target.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  target.setDate(diffToMonday);

  return target;
}

function calculateChange(currentValue, previousValue) {
  if (!previousValue && !currentValue) return 0;
  if (!previousValue) return 100;
  return Math.round(((currentValue - previousValue) / previousValue) * 100);
}

const SLOT_WINDOWS = [
  { startTime: '06:00', endTime: '07:30' },
  { startTime: '07:30', endTime: '09:00' },
  { startTime: '09:00', endTime: '10:30' },
  { startTime: '10:30', endTime: '12:00' },
  { startTime: '12:00', endTime: '13:30' },
  { startTime: '13:30', endTime: '15:00' },
  { startTime: '15:00', endTime: '16:30' },
  { startTime: '16:30', endTime: '18:00' },
  { startTime: '18:00', endTime: '19:30' },
  { startTime: '19:30', endTime: '21:00' },
  { startTime: '21:00', endTime: '22:30' },
];

const BOOKING_AMOUNT_SUM_EXPR = { $ifNull: ['$finalTotal', '$totalPrice'] };

function getBookingAmount(booking) {
  return booking?.finalTotal ?? booking?.totalPrice ?? 0;
}

// Layout chung cho tất cả admin views
const adminLayout = { layout: 'layouts/admin' };
const OWNER_ROLE = 'field_owner';
const APPROVAL_STATUS_VALUES = Object.values(APPROVAL_STATUS);

const getOwnerOptions = async () => {
  return User.find({ role: OWNER_ROLE, isActive: true })
    .select('_id name email')
    .sort({ name: 1 });
};

const normalizeApprovalStatus = (value, fallback = APPROVAL_STATUS.APPROVED) => (
  APPROVAL_STATUS_VALUES.includes(value) ? value : fallback
);

const getApprovalPriority = (status) => {
  if (status === APPROVAL_STATUS.PENDING) return 0;
  if (status === APPROVAL_STATUS.REJECTED) return 1;
  return 2;
};

const applyFieldApprovalDecision = async ({ field, approvalStatus, approvalNote, reviewerId }) => {
  const safeApprovalStatus = normalizeApprovalStatus(approvalStatus, getEffectiveApprovalStatus(field));
  const note = typeof approvalNote === 'string' ? approvalNote.trim() : '';

  field.approvalStatus = safeApprovalStatus;
  field.approvalNote = note;

  if (safeApprovalStatus === APPROVAL_STATUS.APPROVED) {
    field.approvedBy = reviewerId || null;
    field.approvedAt = new Date();
  } else if (safeApprovalStatus === APPROVAL_STATUS.REJECTED) {
    field.approvedBy = reviewerId || null;
    field.approvedAt = new Date();
  } else {
    field.approvedBy = null;
    field.approvedAt = null;
  }

  return field;
};

// ================================
// GET /admin/dashboard — Trang tổng quan
// ================================
const getDashboard = async (req, res) => {
  try {
    const range = parseInt(req.query.range) === 30 ? 30 : 7;
    const todayBounds = getDayBounds();
    const trendStartDate = new Date(todayBounds.start);
    trendStartDate.setDate(trendStartDate.getDate() - range + 1);

    const currentWeekStart = getStartOfWeek(new Date());
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);

    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setMilliseconds(-1);

    const [
      totalUsers,
      totalFields,
      activeFields,
      pendingBookings,
      todayBookings,
      confirmedToday,
      todayRevenueAgg,
      recentBookings,
      bookingTrendsObj,
      currentWeekVolume,
      previousWeekVolume,
      currentWeekRevenueAgg,
      previousWeekRevenueAgg,
    ] = await Promise.all([
      User.countDocuments(),
      Field.countDocuments({ status: { $ne: 'deleted' } }),
      Field.countDocuments({ status: 'active', ...APPROVED_OR_LEGACY_CLAUSE }),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ date: { $gte: todayBounds.start, $lte: todayBounds.end } }),
      Booking.countDocuments({ status: 'confirmed', date: { $gte: todayBounds.start, $lte: todayBounds.end } }),
      Booking.aggregate([
        { $match: { status: 'confirmed', date: { $gte: todayBounds.start, $lte: todayBounds.end } } },
        { $group: { _id: null, total: { $sum: BOOKING_AMOUNT_SUM_EXPR } } },
      ]),
      Booking.find()
        .populate('user', 'name')
        .populate('field', 'name')
        .sort({ createdAt: -1 })
        .limit(6),
      Booking.aggregate([
        { $match: { date: { $gte: trendStartDate, $lte: todayBounds.end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Ho_Chi_Minh' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Booking.countDocuments({ createdAt: { $gte: currentWeekStart } }),
      Booking.countDocuments({ createdAt: { $gte: previousWeekStart, $lte: previousWeekEnd } }),
      Booking.aggregate([
        { $match: { status: 'confirmed', createdAt: { $gte: currentWeekStart } } },
        { $group: { _id: null, total: { $sum: BOOKING_AMOUNT_SUM_EXPR } } },
      ]),
      Booking.aggregate([
        { $match: { status: 'confirmed', createdAt: { $gte: previousWeekStart, $lte: previousWeekEnd } } },
        { $group: { _id: null, total: { $sum: BOOKING_AMOUNT_SUM_EXPR } } },
      ]),
    ]);

    const dailyRevenue = todayRevenueAgg.length > 0 ? todayRevenueAgg[0].total : 0;
    const currentWeekRevenue = currentWeekRevenueAgg.length > 0 ? currentWeekRevenueAgg[0].total : 0;
    const previousWeekRevenue = previousWeekRevenueAgg.length > 0 ? previousWeekRevenueAgg[0].total : 0;
    const totalDailyCapacity = activeFields * SLOT_WINDOWS.length;
    const occupancyRate = totalDailyCapacity > 0 ? Number(((todayBookings / totalDailyCapacity) * 100).toFixed(1)) : 0;

    const chartData = [];
    let maxBookings = 0;

    for (let i = range - 1; i >= 0; i--) {
      const date = new Date(todayBounds.start);
      date.setDate(todayBounds.start.getDate() - i);

      const dateStr = toLocalDateString(date);
      const match = bookingTrendsObj.find((item) => item._id === dateStr);
      const count = match ? match.count : 0;

      maxBookings = Math.max(maxBookings, count);

      chartData.push({
        date: dateStr,
        shortLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
        fullLabel: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        count,
      });
    }

    const peakDay = chartData.reduce(
      (best, item) => (item.count > best.count ? item : best),
      chartData[0] || { shortLabel: '--', count: 0 }
    );

    res.render('admin/dashboard', {
      ...adminLayout,
      title: 'Admin Dashboard',
      activeNav: 'dashboard',
      pageTitle: 'Tactical Dashboard',
      stats: {
        totalUsers,
        totalFields,
        activeFields,
        pendingBookings,
        todayBookings,
        confirmedToday,
        dailyRevenue,
        occupancyRate,
      },
      trends: {
        volumeChange: calculateChange(currentWeekVolume, previousWeekVolume),
        revenueChange: calculateChange(currentWeekRevenue, previousWeekRevenue),
      },
      recentBookings,
      chartData,
      maxBookings: maxBookings || 1,
      currentRange: range,
      peakDay,
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    req.flash('error', 'Lỗi khi tải dashboard!');
    res.redirect('/');
  }
};


// ================================
// QUẢN LÝ LỊCH ĐẶT SÂN (SCHEDULE)
// ================================
const getSchedule = async (req, res) => {
  try {
    const queryDateStr = req.query.date;
    const requestedFieldId = req.query.fieldId || 'all';
    const baseDate = queryDateStr ? parseLocalDate(queryDateStr) : new Date();
    const startOfWeek = getStartOfWeek(baseDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const prevWeek = new Date(startOfWeek);
    prevWeek.setDate(startOfWeek.getDate() - 7);

    const nextWeek = new Date(startOfWeek);
    nextWeek.setDate(startOfWeek.getDate() + 7);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let weekTitle = `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()}`;
    weekTitle += startOfWeek.getMonth() === endOfWeek.getMonth()
      ? ` — ${endOfWeek.getDate()}`
      : ` — ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}`;

    const fieldOptions = await Field.find({ status: { $ne: 'deleted' } })
      .select('_id name status type')
      .sort({ name: 1 });

    const selectedField = requestedFieldId !== 'all'
      ? fieldOptions.find((field) => field._id.toString() === requestedFieldId) || null
      : null;
    const selectedFieldId = selectedField ? selectedField._id.toString() : 'all';

    const bookingFilter = { date: { $gte: startOfWeek, $lte: endOfWeek } };
    if (selectedField) {
      bookingFilter.field = selectedField._id;
    }

    const bookings = await Booking.find(bookingFilter)
      .populate('field', 'name type status')
      .populate('user', 'name')
      .sort({ date: 1, startTime: 1 });

    const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const todayKey = toLocalDateString(new Date());
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + index);

      return {
        name: dayLabels[index],
        dateNum: currentDate.getDate(),
        fullDateStr: toLocalDateString(currentDate),
        isToday: toLocalDateString(currentDate) === todayKey,
      };
    });

    const bookingMap = new Map();
    bookings.forEach((booking) => {
      const key = `${toLocalDateString(new Date(booking.date))}_${booking.startTime}`;
      if (!bookingMap.has(key)) {
        bookingMap.set(key, []);
      }
      bookingMap.get(key).push(booking);
    });

    const scheduleRows = SLOT_WINDOWS.map((slot) => ({
      ...slot,
      cells: weekDays.map((day) => ({
        date: day.fullDateStr,
        bookings: bookingMap.get(`${day.fullDateStr}_${slot.startTime}`) || [],
      })),
    }));

    const weekStats = {
      total: bookings.length,
      confirmed: bookings.filter((booking) => booking.status === 'confirmed').length,
      pending: bookings.filter((booking) => booking.status === 'pending').length,
      rejected: bookings.filter((booking) => ['rejected', 'cancelled'].includes(booking.status)).length,
    };

    res.render('admin/schedule', {
      ...adminLayout,
      title: 'Pitch Schedule',
      activeNav: 'schedule',
      pageTitle: 'Pitch Schedule',
      weekTitle,
      weekDays,
      scheduleRows,
      fieldOptions,
      selectedField,
      selectedFieldId,
      weekStats,
      currentDateStr: toLocalDateString(baseDate),
      prevWeekStr: toLocalDateString(prevWeek),
      nextWeekStr: toLocalDateString(nextWeek),
      todayStr: toLocalDateString(new Date()),
    });
  } catch (error) {
    console.error('Schedule Error:', error);
    req.flash('error', 'Lỗi khi tải lịch sân!');
    res.redirect('/admin/dashboard');
  }
};

// ================================
// QUẢN LÝ ĐƠN ĐẶT SÂN (BOOKINGS)
// ================================

// GET /admin/bookings — Danh sách đơn đặt sân
const getBookings = async (req, res) => {
  try {
    const { status, fieldId = 'all', page = 1 } = req.query;
    const limit = 10;
    const safeFieldId = fieldId !== 'all' && mongoose.Types.ObjectId.isValid(fieldId) ? fieldId : 'all';

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (safeFieldId !== 'all') filter.field = safeFieldId;

    const scopeFilter = {};
    if (safeFieldId !== 'all') scopeFilter.field = safeFieldId;

    const currentPage = parseInt(page, 10) || 1;

    const currentWeekStart = getStartOfWeek(new Date());
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);

    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setMilliseconds(-1);

    const [
      bookings,
      total,
      fieldOptions,
      totalVolume,
      pendingConf,
      confirmedConf,
      totalRevenueAgg,
      currentWeekVolume,
      previousWeekVolume,
      currentWeekRevenueAgg,
      previousWeekRevenueAgg,
    ] = await Promise.all([
      Booking.find(filter)
        .populate('user', 'name email phone')
        .populate('field', 'name')
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * limit)
        .limit(limit),
      Booking.countDocuments(filter),
      Field.find({ status: { $ne: 'deleted' } }).select('_id name').sort({ name: 1 }),
      Booking.countDocuments(scopeFilter),
      Booking.countDocuments({ ...scopeFilter, status: 'pending' }),
      Booking.countDocuments({ ...scopeFilter, status: 'confirmed' }),
      Booking.aggregate([
        { $match: { ...scopeFilter, status: 'confirmed' } },
        { $group: { _id: null, total: { $sum: BOOKING_AMOUNT_SUM_EXPR } } },
      ]),
      Booking.countDocuments({ ...scopeFilter, createdAt: { $gte: currentWeekStart } }),
      Booking.countDocuments({ ...scopeFilter, createdAt: { $gte: previousWeekStart, $lte: previousWeekEnd } }),
      Booking.aggregate([
        { $match: { ...scopeFilter, status: 'confirmed', createdAt: { $gte: currentWeekStart } } },
        { $group: { _id: null, total: { $sum: BOOKING_AMOUNT_SUM_EXPR } } },
      ]),
      Booking.aggregate([
        { $match: { ...scopeFilter, status: 'confirmed', createdAt: { $gte: previousWeekStart, $lte: previousWeekEnd } } },
        { $group: { _id: null, total: { $sum: BOOKING_AMOUNT_SUM_EXPR } } },
      ]),
    ]);

    const totalRevenue = totalRevenueAgg.length > 0 ? totalRevenueAgg[0].total : 0;
    const currentWeekRevenue = currentWeekRevenueAgg.length > 0 ? currentWeekRevenueAgg[0].total : 0;
    const previousWeekRevenue = previousWeekRevenueAgg.length > 0 ? previousWeekRevenueAgg[0].total : 0;
    const utilization = totalVolume > 0 ? Math.round((confirmedConf / totalVolume) * 100) : 0;
    const startItem = total === 0 ? 0 : ((currentPage - 1) * limit) + 1;
    const endItem = Math.min(currentPage * limit, total);

    res.render('admin/bookings/index', {
      ...adminLayout,
      title: 'Quản lý đơn đặt sân',
      activeNav: 'bookings',
      pageTitle: 'Booking Ledger',
      bookings,
      currentStatus: status || 'all',
      currentFieldId: safeFieldId,
      fieldOptions,
      currentPage,
      totalPages: Math.ceil(total / limit) || 1,
      totalItems: total,
      startItem,
      endItem,
      stats: {
        totalVolume,
        pendingConf,
        totalRevenue,
        utilization,
      },
      trends: {
        volumeChange: calculateChange(currentWeekVolume, previousWeekVolume),
        revenueChange: calculateChange(currentWeekRevenue, previousWeekRevenue),
      },
    });
  } catch (error) {
    console.error('Get Bookings Error:', error);
    req.flash('error', 'Lỗi khi tải danh sách đơn!');
    res.redirect('/admin/dashboard');
  }
};

// GET /admin/bookings/:id — Chi tiết đơn đặt sân
const getBookingDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('user', 'name email phone')
      .populate('field', 'name address pricePerSlot images');

    if (!booking) {
      req.flash('error', 'Không tìm thấy đơn đặt sân!');
      return res.redirect('/admin/bookings');
    }

    res.render('admin/bookings/detail', {
      ...adminLayout,
      title: 'Chi tiết đơn đặt sân',
      activeNav: 'bookings',
      pageIcon: '📄',
      pageTitle: 'Chi tiết đơn đặt sân',
      topbarRight: '<a href="/admin/bookings" class="btn btn-sm btn-outline">← Quay lại</a>',
      booking,
    });
  } catch (error) {
    console.error('Booking Detail Error:', error);
    req.flash('error', 'Lỗi khi tải chi tiết đơn!');
    res.redirect('/admin/bookings');
  }
};

// POST /admin/bookings/:id/approve — Duyệt đơn
const approveBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id).populate('user', 'name email').populate('field', 'name');
    if (!booking) {
      req.flash('error', 'Không tìm thấy đơn!');
      return res.redirect('/admin/bookings');
    }

    // Chỉ cho phép duyệt đơn đang pending
    if (booking.status !== 'pending') {
      req.flash('error', 'Đơn này đã được xử lý rồi!');
      return res.redirect(`/admin/bookings/${id}`);
    }

    // Cập nhật trạng thái booking → confirmed
    booking.status = 'confirmed';
    booking.approvedBy = req.session.user._id;
    booking.approvedAt = new Date();

    const field = await Field.findById(booking.field).populate('owner', 'commissionRate');
    const rate = field.owner?.commissionRate || 5;
    const bookingAmount = getBookingAmount(booking);
    booking.finalTotal = bookingAmount;
    booking.commissionAmount = Math.round(bookingAmount * (rate / 100));
    booking.ownerRevenue = bookingAmount - booking.commissionAmount;
    booking.isRevenueCalculated = true;

    await booking.save();
    await TimeSlot.findByIdAndUpdate(booking.timeSlot, {
      status: 'booked',
      bookedBy: booking.user,
    });
    if (booking.user?.email) {
      await sendBookingConfirmationAsync(booking.user.email, booking);
    }

    req.flash('success', 'Đã duyệt đơn đặt sân thành công!');
    res.redirect(`/admin/bookings/${id}`);
  } catch (error) {
    console.error('Approve Booking Error:', error);
    req.flash('error', 'Lỗi khi duyệt đơn!');
    res.redirect('/admin/bookings');
  }
};

// POST /admin/bookings/:id/reject — Từ chối đơn
const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(id).populate('user', 'name email').populate('field', 'name');
    if (!booking) {
      req.flash('error', 'Không tìm thấy đơn!');
      return res.redirect('/admin/bookings');
    }

    // Chỉ cho phép từ chối đơn đang pending
    if (booking.status !== 'pending') {
      req.flash('error', 'Đơn này đã được xử lý rồi!');
      return res.redirect(`/admin/bookings/${id}`);
    }

    // Cập nhật trạng thái booking → rejected
    booking.status = 'rejected';
    booking.rejectedReason = reason || 'Không đạt yêu cầu';
    booking.approvedBy = req.session.user._id;
    await booking.save();

    // Nhả TimeSlot → available (cho người khác đặt)
    await TimeSlot.findByIdAndUpdate(booking.timeSlot, {
      status: 'available',
      bookedBy: null,
    });
    if (booking.user?.email) {
      await sendBookingConfirmationAsync(booking.user.email, booking);
    }

    req.flash('success', 'Đã từ chối đơn đặt sân.');
    res.redirect(`/admin/bookings/${id}`);
  } catch (error) {
    console.error('Reject Booking Error:', error);
    req.flash('error', 'Lỗi khi từ chối đơn!');
    res.redirect('/admin/bookings');
  }
};

// ================================
// QUẢN LÝ SÂN BÓNG (FIELDS)
// ================================

// GET /admin/fields — Danh sách sân
const getFields = async (req, res) => {
  try {
    const fields = await Field.find({ status: { $ne: 'deleted' } })
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });

    fields.sort((a, b) => {
      const approvalDiff = getApprovalPriority(getEffectiveApprovalStatus(a)) - getApprovalPriority(getEffectiveApprovalStatus(b));
      if (approvalDiff !== 0) return approvalDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // KPI Calculations
    const totalFields = fields.length;
    const activeFields = fields.filter(f => f.status === 'active').length;
    const maintenanceFields = fields.filter(f => f.status === 'maintenance').length;
    const pendingApprovalFields = fields.filter((field) => getEffectiveApprovalStatus(field) === APPROVAL_STATUS.PENDING).length;
    const rejectedApprovalFields = fields.filter((field) => getEffectiveApprovalStatus(field) === APPROVAL_STATUS.REJECTED).length;

    res.render('admin/fields/index', {
      ...adminLayout,
      title: 'Quản lý sân bóng',
      activeNav: 'fields',
      pageIcon: '🏟️',
      pageTitle: 'Quản lý sân bóng',
      topbarRight: '', // Overwritten by the template design header
      fields,
      stats: {
        totalFields,
        activeFields,
        maintenanceFields,
        pendingApprovalFields,
        rejectedApprovalFields,
      }
    });
  } catch (error) {
    console.error('Get Fields Error:', error);
    req.flash('error', 'Lỗi khi tải danh sách sân!');
    res.redirect('/admin/dashboard');
  }
};

// GET /admin/fields/create — Form tạo sân mới
const showCreateField = async (req, res) => {
  try {
    const owners = await getOwnerOptions();
    res.render('admin/fields/create', {
      ...adminLayout,
      title: 'Thêm sân mới',
      activeNav: 'fields',
      pageIcon: '➕',
      pageTitle: 'Thêm sân bóng mới',
      topbarRight: '<a href="/admin/fields" class="btn btn-sm btn-outline">← Quay lại</a>',
      owners,
    });
  } catch (error) {
    console.error('Show Create Field Error:', error);
    req.flash('error', 'Lỗi khi tải form tạo sân!');
    res.redirect('/admin/fields');
  }
};

// POST /admin/fields — Tạo sân mới
const createField = async (req, res) => {
  try {
    const { name, address, city, district, type, pricePerSlot, description, facilities, owner } = req.body || {};

    if (!name || !address || !city || !district || !type || !pricePerSlot) {
      req.flash('error', 'Vui lòng điền đầy đủ thông tin bắt buộc!');
      return res.redirect('/admin/fields/create');
    }

    let ownerId = null;
    if (owner) {
      const ownerExists = await User.exists({ _id: owner, role: OWNER_ROLE });
      ownerId = ownerExists ? owner : null;
    }

    const facilitiesArr = [];
    if (facilities) {
      if (Array.isArray(facilities)) {
        facilitiesArr.push(...facilities);
      } else {
        facilitiesArr.push(facilities);
      }
    }

    await Field.create({
      name,
      address,
      city,
      district,
      type,
      pricePerSlot,
      description,
      facilities: facilitiesArr,
      owner: ownerId,
      images: req.cloudinaryUrls || [],
      approvalStatus: APPROVAL_STATUS.APPROVED,
      approvalNote: 'Tạo trực tiếp từ admin portal.',
      approvedBy: req.session.user._id,
      approvedAt: new Date(),
      submittedByOwner: false,
    });

    req.flash('success', 'Thêm sân mới thành công!');
    res.redirect('/admin/fields');
  } catch (error) {
    console.error('Create Field Error:', error);
    req.flash('error', 'Lỗi khi tạo sân!');
    res.redirect('/admin/fields/create');
  }
};

// GET /admin/fields/:id/edit — Form chỉnh sửa sân
const showEditField = async (req, res) => {
  try {
    const { id } = req.params;

    const [field, owners] = await Promise.all([
      Field.findById(id),
      getOwnerOptions(),
    ]);
    if (!field) {
      req.flash('error', 'Không tìm thấy sân!');
      return res.redirect('/admin/fields');
    }

    res.render('admin/fields/edit', {
      ...adminLayout,
      title: 'Chỉnh sửa sân',
      activeNav: 'fields',
      pageIcon: '✏️',
      pageTitle: 'Chỉnh sửa sân bóng',
      topbarRight: '<a href="/admin/fields" class="btn btn-sm btn-outline">← Quay lại</a>',
      field,
      owners,
    });
  } catch (error) {
    console.error('Edit Field Error:', error);
    req.flash('error', 'Lỗi khi tải thông tin sân!');
    res.redirect('/admin/fields');
  }
};

// POST /admin/fields/:id — Cập nhật sân
const updateField = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      address,
      city,
      district,
      type,
      pricePerSlot,
      description,
      status,
      facilities,
      owner,
      approvalStatus,
      approvalNote,
    } = req.body || {};

    if (!name || !address || !city || !district) {
      req.flash('error', 'Vui lòng điền đầy đủ thông tin!');
      return res.redirect(`/admin/fields/${id}/edit`);
    }

    const field = await Field.findById(id);
    if (!field) {
      req.flash('error', 'Không tìm thấy sân!');
      return res.redirect('/admin/fields');
    }

    let ownerId = null;
    if (owner) {
      const ownerExists = await User.exists({ _id: owner, role: OWNER_ROLE });
      ownerId = ownerExists ? owner : null;
    }

    const facilitiesArr = [];
    if (facilities) {
      if (Array.isArray(facilities)) {
        facilitiesArr.push(...facilities);
      } else {
        facilitiesArr.push(facilities);
      }
    }

    const safeStatus = ['active', 'maintenance', 'deleted'].includes(status) ? status : field.status;

    field.name = name;
    field.address = address;
    field.city = city;
    field.district = district;
    field.type = type;
    field.pricePerSlot = pricePerSlot;
    field.description = description;
    field.status = safeStatus;
    field.facilities = facilitiesArr;
    field.owner = ownerId;

    if (req.cloudinaryUrls && req.cloudinaryUrls.length > 0) {
      field.images = req.cloudinaryUrls;
    }

    if (req.session.user?.role === 'admin') {
      await applyFieldApprovalDecision({
        field,
        approvalStatus,
        approvalNote,
        reviewerId: req.session.user._id,
      });
    }

    await field.save();

    req.flash('success', 'Cập nhật sân thành công!');
    res.redirect('/admin/fields');
  } catch (error) {
    console.error('Update Field Error:', error);
    req.flash('error', 'Lỗi khi cập nhật sân!');
    res.redirect(`/admin/fields/${req.params.id}/edit`);
  }
};

// POST /admin/fields/:id/approval — Duyệt hoặc từ chối sân do owner gửi lên
const updateFieldApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus, approvalNote } = req.body || {};

    const field = await Field.findById(id);
    if (!field) {
      req.flash('error', 'Không tìm thấy sân!');
      return res.redirect('/admin/fields');
    }

    const safeApprovalStatus = normalizeApprovalStatus(approvalStatus, getEffectiveApprovalStatus(field));
    await applyFieldApprovalDecision({
      field,
      approvalStatus: safeApprovalStatus,
      approvalNote,
      reviewerId: req.session.user._id,
    });
    await field.save();

    const message = safeApprovalStatus === APPROVAL_STATUS.APPROVED
      ? `Đã duyệt sân ${field.name}.`
      : safeApprovalStatus === APPROVAL_STATUS.REJECTED
        ? `Đã từ chối sân ${field.name}.`
        : `Đã chuyển sân ${field.name} về trạng thái chờ duyệt.`;

    req.flash('success', message);
    return res.redirect('/admin/fields');
  } catch (error) {
    console.error('Update Field Approval Error:', error);
    req.flash('error', 'Lỗi khi cập nhật trạng thái duyệt sân!');
    return res.redirect('/admin/fields');
  }
};

// POST /admin/fields/:id/delete — Xóa sân
const deleteField = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra còn booking confirmed/pending không
    const activeBookings = await Booking.countDocuments({
      field: id,
      status: { $in: ['confirmed', 'pending'] },
    });
    if (activeBookings > 0) {
      req.flash('error', `Không thể xóa sân vì còn ${activeBookings} đơn đặt đang hoạt động (confirmed/pending). Vui lòng xử lý hết trước!`);
      return res.redirect('/admin/fields');
    }

    // Xóa tất cả Booking và TimeSlot liên kết để tránh rác dữ liệu
    await Booking.deleteMany({ field: id });
    await TimeSlot.deleteMany({ field: id });

    // Sau đó mới xóa Sân bóng
    await Field.findByIdAndDelete(id);

    req.flash('success', 'Đã xóa sân thành công!');
    res.redirect('/admin/fields');
  } catch (error) {
    console.error('Delete Field Error:', error);
    req.flash('error', 'Lỗi khi xóa sân!');
    res.redirect('/admin/fields');
  }
};

// ================================
// QUẢN LÝ USERS
// ================================

// GET /admin/users — Danh sách người dùng
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    const [total, users, fieldOptions] = await Promise.all([
      User.countDocuments(),
      User.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Field.find({ status: { $ne: 'deleted' } })
        .select('_id name owner type')
        .populate('owner', 'name')
        .sort({ name: 1 }),
    ]);

    const userIds = users.map((user) => user._id);
    const ownedFields = await Field.find({
      owner: { $in: userIds },
      status: { $ne: 'deleted' },
    })
      .select('_id name owner type status')
      .sort({ name: 1 });

    const ownedFieldsMap = {};
    ownedFields.forEach((field) => {
      const ownerKey = field.owner ? field.owner.toString() : null;
      if (!ownerKey) return;

      if (!ownedFieldsMap[ownerKey]) {
        ownedFieldsMap[ownerKey] = [];
      }

      ownedFieldsMap[ownerKey].push(field);
    });

    res.render('admin/users/index', {
      ...adminLayout,
      title: 'Quản lý người dùng',
      activeNav: 'users',
      pageIcon: '👥',
      pageTitle: 'Quản lý người dùng',
      topbarRight: `<span>Tổng: <strong>${total}</strong> người dùng</span>`,
      users,
      fieldOptions,
      ownedFieldsMap,
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error('Get Users Error:', error);
    req.flash('error', 'Lỗi khi tải danh sách người dùng!');
    res.redirect('/admin/dashboard');
  }
};

// POST /admin/users/:id/permissions — Cập nhật role + gán sân cho owner
const updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, commissionRate, assignedFieldId } = req.body || {};

    const user = await User.findById(id);
    if (!user) {
      req.flash('error', 'Không tìm thấy người dùng!');
      return res.redirect('/admin/users');
    }

    if (user._id.toString() === req.session.user._id.toString()) {
      req.flash('error', 'Không thể tự thay đổi quyền của chính mình tại màn này!');
      return res.redirect('/admin/users');
    }

    if (user.role === 'admin') {
      req.flash('error', 'Tài khoản admin được bảo vệ. Hãy dùng luồng riêng nếu muốn thay đổi.');
      return res.redirect('/admin/users');
    }

    const safeRole = ['user', 'field_owner'].includes(role) ? role : null;
    if (!safeRole) {
      req.flash('error', 'Vai trò không hợp lệ!');
      return res.redirect('/admin/users');
    }

    const parsedRate = Number(commissionRate);
    const safeCommissionRate = Number.isFinite(parsedRate) ? Math.min(10, Math.max(2, parsedRate)) : (user.commissionRate || 5);
    const currentlyOwnedFields = await Field.find({ owner: user._id }).select('_id name');

    let assignedField = null;
    if (assignedFieldId) {
      if (!mongoose.Types.ObjectId.isValid(assignedFieldId)) {
        req.flash('error', 'Sân được chọn không hợp lệ!');
        return res.redirect('/admin/users');
      }

      assignedField = await Field.findOne({
        _id: assignedFieldId,
        status: { $ne: 'deleted' },
      }).populate('owner', 'name');

      if (!assignedField) {
        req.flash('error', 'Không tìm thấy sân để gán owner!');
        return res.redirect('/admin/users');
      }
    }

    if (safeRole === 'user') {
      await Field.updateMany({ owner: user._id }, { $set: { owner: null } });
    }

    user.role = safeRole;
    user.commissionRate = safeCommissionRate;
    await user.save();

    let transferMessage = '';
    if (safeRole === 'field_owner' && assignedField) {
      const previousOwnerName = assignedField.owner && assignedField.owner._id.toString() !== user._id.toString()
        ? assignedField.owner.name
        : null;

      await Field.updateOne(
        { _id: assignedField._id },
        { $set: { owner: user._id } }
      );

      if (previousOwnerName) {
        transferMessage = ` Quyền sở hữu sân ${assignedField.name} đã được chuyển từ ${previousOwnerName} sang ${user.name}.`;
      } else {
        transferMessage = ` Đã gán ${user.name} làm owner của sân ${assignedField.name}.`;
      }
    }

    if (safeRole === 'user') {
      req.flash('success', `Đã chuyển ${user.name} về vai trò user và gỡ ${currentlyOwnedFields.length} sân đang sở hữu.`);
      return res.redirect('/admin/users');
    }

    if (!assignedField && currentlyOwnedFields.length === 0) {
      req.flash('success', `Đã cấp quyền owner cho ${user.name}. Bạn có thể gán sân ngay tại màn này hoặc từ trang Pitch Assets.`);
      return res.redirect('/admin/users');
    }

    req.flash('success', `Đã cập nhật quyền cho ${user.name}.${transferMessage}`);
    return res.redirect('/admin/users');
  } catch (error) {
    console.error('Update User Permissions Error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((item) => item.message);
      req.flash('error', messages.join(', '));
      return res.redirect('/admin/users');
    }
    req.flash('error', 'Lỗi khi cập nhật quyền người dùng!');
    return res.redirect('/admin/users');
  }
};

// POST /admin/users/:id/toggle — Khóa/mở khóa tài khoản
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      req.flash('error', 'Không tìm thấy người dùng!');
      return res.redirect('/admin/users');
    }

    // Không cho phép tự khóa chính mình
    if (user._id.toString() === req.session.user._id.toString()) {
      req.flash('error', 'Không thể khóa tài khoản của chính mình!');
      return res.redirect('/admin/users');
    }

    user.isActive = !user.isActive;
    await user.save();

    req.flash('success', `Đã ${user.isActive ? 'mở khóa' : 'khóa'} tài khoản ${user.name}`);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Toggle User Error:', error);
    req.flash('error', 'Lỗi khi thay đổi trạng thái tài khoản!');
    res.redirect('/admin/users');
  }
};

// ================================
// ADMIN SEARCH API
// ================================
const searchAdmin = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    const regex = new RegExp(q, 'i');

    const [fields, users, bookings] = await Promise.all([
      Field.find({
        status: { $ne: 'deleted' },
        $or: [{ name: regex }, { address: regex }, { city: regex }],
      })
        .select('_id name address type status')
        .limit(5),
      User.find({
        $or: [{ name: regex }, { email: regex }, { phone: regex }],
      })
        .select('_id name email role')
        .limit(5),
      Booking.find({
        $or: [{ startTime: regex }, { endTime: regex }],
      })
        .populate('user', 'name')
        .populate('field', 'name')
        .select('_id status date startTime endTime')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    const results = [];

    fields.forEach((f) => {
      results.push({
        type: 'field',
        icon: 'stadium',
        title: f.name,
        subtitle: `${f.address} · ${f.type}`,
        url: `/admin/fields/${f._id}/edit`,
        status: f.status,
      });
    });

    users.forEach((u) => {
      results.push({
        type: 'user',
        icon: 'person',
        title: u.name,
        subtitle: `${u.email} · ${u.role}`,
        url: '/admin/users',
      });
    });

    bookings.forEach((b) => {
      results.push({
        type: 'booking',
        icon: 'event_available',
        title: `#${b._id.toString().slice(-6).toUpperCase()}`,
        subtitle: `${b.field ? b.field.name : 'Unknown'} · ${b.startTime}-${b.endTime}`,
        url: `/admin/bookings/${b._id}`,
        status: b.status,
      });
    });

    res.json({ results });
  } catch (error) {
    console.error('Admin Search Error:', error);
    res.status(500).json({ results: [], error: 'Search failed' });
  }
};

// ================================
// EXPORT BOOKINGS CSV
// ================================
const exportBookingsCSV = async (req, res) => {
  try {
    const { status, fieldId = 'all' } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (fieldId !== 'all' && mongoose.Types.ObjectId.isValid(fieldId)) filter.field = fieldId;

    const bookings = await Booking.find(filter)
      .populate('user', 'name email phone')
      .populate('field', 'name')
      .sort({ createdAt: -1 })
      .limit(5000);

    // BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const headers = ['ID', 'Khách hàng', 'Email', 'SĐT', 'Sân', 'Ngày', 'Giờ bắt đầu', 'Giờ kết thúc', 'Số tiền', 'Trạng thái', 'Ngày tạo'];
    const rows = bookings.map((b) => {
      const amount = b.finalTotal ?? b.totalPrice ?? 0;
      return [
        b._id.toString().slice(-6).toUpperCase(),
        b.user ? b.user.name : 'Unknown',
        b.user ? b.user.email || '' : '',
        b.user ? b.user.phone || '' : '',
        b.field ? b.field.name : 'Deleted',
        b.date ? new Date(b.date).toLocaleDateString('vi-VN') : '',
        b.startTime || '',
        b.endTime || '',
        amount,
        b.status || '',
        b.createdAt ? new Date(b.createdAt).toLocaleDateString('vi-VN') : '',
      ].map((val) => {
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',');
    });

    const csv = BOM + headers.join(',') + '\n' + rows.join('\n');
    const filename = `bookings_export_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export CSV Error:', error);
    req.flash('error', 'Lỗi khi xuất dữ liệu!');
    res.redirect('/admin/bookings');
  }
};

module.exports = {
  getDashboard,
  getSchedule,
  getBookings,
  getBookingDetail,
  approveBooking,
  rejectBooking,
  getFields,
  showCreateField,
  createField,
  showEditField,
  updateField,
  updateFieldApproval,
  deleteField,
  getUsers,
  toggleUserStatus,
  updateUserPermissions,
  searchAdmin,
  exportBookingsCSV,
};
