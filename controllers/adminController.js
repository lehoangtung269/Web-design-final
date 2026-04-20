const User = require('../models/User');
const Booking = require('../models/Booking');
const Field = require('../models/Field');
const TimeSlot = require('../models/TimeSlot');

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

// Layout chung cho tất cả admin views
const adminLayout = { layout: 'layouts/admin' };

// ================================
// GET /admin/dashboard — Trang tổng quan
// ================================
const getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const totalFields = await Field.countDocuments();

    // Fetch recent bookings for dashboard table
    const recentBookings = await Booking.find()
      .populate('user', 'name')
      .populate('field', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Handle ?range= parameter for dashboard chart (default 7 days)
    const range = parseInt(req.query.range) === 30 ? 30 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range + 1); // +1 so if range=7, it's today + 6 previous days = 7 days total.
    startDate.setHours(0, 0, 0, 0);

    const bookingTrendsObj = await Booking.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const chartData = [];
    let maxBookings = 0;

    // Generate dates including empty days
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const dateStr = toLocalDateString(d);
      const match = bookingTrendsObj.find(b => b._id === dateStr);
      const count = match ? match.count : 0;

      if (count > maxBookings) maxBookings = count;

      chartData.push({
        date: dateStr,
        label: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        count: count
      });
    }

    if (maxBookings === 0) maxBookings = 1; // Prevent division by zero

    res.render('admin/dashboard', {
      ...adminLayout,
      title: 'Admin Dashboard',
      activeNav: 'dashboard',
      pageIcon: '📊',
      pageTitle: 'Dashboard',
      stats: {
        totalUsers,
        totalBookings,
        pendingBookings,
        totalFields,
      },
      recentBookings,
      chartData,
      maxBookings,
      currentRange: range
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
    // Determine the base date from query, or default to today
    const queryDateStr = req.query.date;
    const baseDate = queryDateStr ? parseLocalDate(queryDateStr) : new Date();

    // Set to 00:00:00 local time
    baseDate.setHours(0, 0, 0, 0);

    // Calculate Monday (1) to Sunday (0 -> 7 in logic) of the current base date's week
    const dayOfWeek = baseDate.getDay();
    const diffToMonday = baseDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);

    const startOfWeek = new Date(baseDate.setDate(diffToMonday));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Prepare navigation dates (prev week, next week, today)
    const prevWeek = new Date(startOfWeek);
    prevWeek.setDate(startOfWeek.getDate() - 7);

    const nextWeek = new Date(startOfWeek);
    nextWeek.setDate(startOfWeek.getDate() + 7);

    // Format week title (e.g., "October 21 — 27")
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let weekTitle = `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()}`;
    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
      weekTitle += ` — ${endOfWeek.getDate()}`;
    } else {
      weekTitle += ` — ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}`;
    }

    // Fetch all bookings within this week
    const bookings = await Booking.find({
      date: { $gte: startOfWeek, $lte: endOfWeek }
    }).populate('field', 'name').populate('user', 'name');

    // Create a 7-day array structure
    const daysName = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);

      // Find bookings exactly falling on this day
      const dayBookings = bookings.filter(b => {
        const bDate = new Date(b.date);
        // Compare using local date components to avoid timezone shift
        return bDate.getFullYear() === currentDate.getFullYear() && bDate.getMonth() === currentDate.getMonth() && bDate.getDate() === currentDate.getDate();
      });

      weekDays.push({
        name: daysName[i],
        dateNum: currentDate.getDate(),
        fullDateStr: toLocalDateString(currentDate),
        isToday: (currentDate.toDateString() === new Date().toDateString()),
        bookings: dayBookings
      });
    }

    res.render('admin/schedule', {
      ...adminLayout,
      title: 'Pitch Schedule',
      activeNav: 'schedule',
      pageTitle: 'Pitch Schedule',
      weekTitle,
      weekDays,
      prevWeekStr: toLocalDateString(prevWeek),
      nextWeekStr: toLocalDateString(nextWeek),
      todayStr: toLocalDateString(new Date())
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
    const { status, page = 1 } = req.query;
    const limit = 10;

    const filter = {};
    if (status && status !== 'all') filter.status = status;

    const bookings = await Booking.find(filter)
      .populate('user', 'name email phone')
      .populate('field', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Booking.countDocuments(filter);

    // KPI Calculations
    const totalVolume = await Booking.countDocuments();
    const pendingConf = await Booking.countDocuments({ status: 'pending' });
    const confirmedConf = await Booking.countDocuments({ status: 'confirmed' });

    const revenueAgg = await Booking.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    // Utilization logic (Confirmed vs Total possible, or just Confirmed vs All Bookings)
    const utilization = totalVolume > 0 ? Math.round((confirmedConf / totalVolume) * 100) : 0;

    res.render('admin/bookings/index', {
      ...adminLayout,
      title: 'Quản lý đơn đặt sân',
      activeNav: 'bookings',
      pageIcon: '📋',
      pageTitle: 'Quản lý đơn đặt sân',
      bookings,
      currentStatus: status || 'all',
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        totalVolume,
        pendingConf,
        totalRevenue,
        utilization
      }
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

    const booking = await Booking.findById(id);
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
    booking.commissionAmount = Math.round(booking.finalTotal * (rate / 100));
    booking.ownerRevenue = booking.finalTotal - booking.commissionAmount;
    booking.isRevenueCalculated = true;

    await booking.save();
    await TimeSlot.findByIdAndUpdate(booking.timeSlot, {
      status: 'booked',
      bookedBy: booking.user,
    });

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

    const booking = await Booking.findById(id);
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
    const fields = await Field.find().sort({ createdAt: -1 });

    // KPI Calculations
    const totalFields = fields.length;
    const activeFields = fields.filter(f => f.status === 'active').length;
    const maintenanceFields = fields.filter(f => f.status === 'maintenance').length;

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
        maintenanceFields
      }
    });
  } catch (error) {
    console.error('Get Fields Error:', error);
    req.flash('error', 'Lỗi khi tải danh sách sân!');
    res.redirect('/admin/dashboard');
  }
};

// GET /admin/fields/create — Form tạo sân mới
const showCreateField = (req, res) => {
  res.render('admin/fields/create', {
    ...adminLayout,
    title: 'Thêm sân mới',
    activeNav: 'fields',
    pageIcon: '➕',
    pageTitle: 'Thêm sân bóng mới',
    topbarRight: '<a href="/admin/fields" class="btn btn-sm btn-outline">← Quay lại</a>',
  });
};

// POST /admin/fields — Tạo sân mới
const createField = async (req, res) => {
  try {
    const { name, address, type, pricePerSlot, description, facilities } = req.body || {};

    if (!name || !address || !type || !pricePerSlot) {
      req.flash('error', 'Vui lòng điền đầy đủ thông tin bắt buộc!');
      return res.redirect('/admin/fields/create');
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
      type,
      pricePerSlot,
      description,
      facilities: facilitiesArr,
      images: req.cloudinaryUrls || [],
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

    const field = await Field.findById(id);
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
    const { name, address, type, pricePerSlot, description, status, facilities } = req.body || {};

    if (!name || !address) {
      req.flash('error', 'Vui lòng điền đầy đủ thông tin!');
      return res.redirect(`/admin/fields/${id}/edit`);
    }

    const facilitiesArr = [];
    if (facilities) {
      if (Array.isArray(facilities)) {
        facilitiesArr.push(...facilities);
      } else {
        facilitiesArr.push(facilities);
      }
    }

    // Xây dựng object update
    const updateData = { name, address, type, pricePerSlot, description, status, facilities: facilitiesArr };

    // Nếu có ảnh mới được upload lên Cloudinary → thay thế ảnh cũ
    if (req.cloudinaryUrls && req.cloudinaryUrls.length > 0) {
      updateData.images = req.cloudinaryUrls;
    }

    await Field.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

    req.flash('success', 'Cập nhật sân thành công!');
    res.redirect('/admin/fields');
  } catch (error) {
    console.error('Update Field Error:', error);
    req.flash('error', 'Lỗi khi cập nhật sân!');
    res.redirect(`/admin/fields/${req.params.id}/edit`);
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

    const total = await User.countDocuments();
    const users = await User.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render('admin/users/index', {
      ...adminLayout,
      title: 'Quản lý người dùng',
      activeNav: 'users',
      pageIcon: '👥',
      pageTitle: 'Quản lý người dùng',
      topbarRight: `<span>Tổng: <strong>${total}</strong> người dùng</span>`,
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error('Get Users Error:', error);
    req.flash('error', 'Lỗi khi tải danh sách người dùng!');
    res.redirect('/admin/dashboard');
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
  deleteField,
  getUsers,
  toggleUserStatus,
};
