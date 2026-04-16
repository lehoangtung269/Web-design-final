const User = require('../models/User');
const Booking = require('../models/Booking');
const Field = require('../models/Field');
const TimeSlot = require('../models/TimeSlot');

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
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    req.flash('error', 'Lỗi khi tải dashboard!');
    res.redirect('/');
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

    // Cập nhật trạng thái booking → confirmed
    booking.status = 'confirmed';
    booking.approvedBy = req.session.user._id;
    booking.approvedAt = new Date();
    await booking.save();

    // Cập nhật TimeSlot → booked (khóa chính thức)
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

    res.render('admin/fields/index', {
      ...adminLayout,
      title: 'Quản lý sân bóng',
      activeNav: 'fields',
      pageIcon: '🏟️',
      pageTitle: 'Quản lý sân bóng',
      topbarRight: '<a href="/admin/fields/create" class="btn btn-sm btn-green">➕ Thêm sân mới</a>',
      fields,
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
    const { name, address, type, pricePerSlot, description } = req.body;

    await Field.create({
      name,
      address,
      type,
      pricePerSlot,
      description,
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
    const { name, address, type, pricePerSlot, description, status } = req.body;

    await Field.findByIdAndUpdate(id, {
      name, address, type, pricePerSlot, description, status,
    }, { new: true, runValidators: true });

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
    const users = await User.find().sort({ createdAt: -1 });

    res.render('admin/users/index', {
      ...adminLayout,
      title: 'Quản lý người dùng',
      activeNav: 'users',
      pageIcon: '👥',
      pageTitle: 'Quản lý người dùng',
      topbarRight: `<span>Tổng: <strong>${users.length}</strong> người dùng</span>`,
      users,
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
    if (user._id.toString() === req.session.user._id) {
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
