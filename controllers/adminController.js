const User = require('../models/User');

// =====================================================================
// LƯU Ý: Booking và Field model sẽ do thành viên khác trong nhóm tạo.
// Controller này đã có sẵn logic để dùng khi model có sẵn.
// =====================================================================

// ================================
// GET /admin/dashboard — Trang tổng quan
// ================================
const getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    // --- Khi có model Booking & Field, bỏ comment dưới đây ---
    // const Booking = require('../models/Booking');
    // const Field = require('../models/Field');
    // const totalBookings = await Booking.countDocuments();
    // const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    // const totalFields = await Field.countDocuments();

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalUsers,
        totalBookings: 0,    // TODO: thay bằng totalBookings khi có model
        pendingBookings: 0,  // TODO: thay bằng pendingBookings khi có model
        totalFields: 0,      // TODO: thay bằng totalFields khi có model
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

    // --- TODO: Bỏ comment khi có model Booking ---
    // const filter = {};
    // if (status) filter.status = status;
    //
    // const bookings = await Booking.find(filter)
    //   .populate('user', 'name email phone')
    //   .populate('field', 'name')
    //   .sort({ createdAt: -1 })
    //   .skip((page - 1) * limit)
    //   .limit(limit);
    //
    // const total = await Booking.countDocuments(filter);

    res.render('admin/bookings/index', {
      title: 'Quản lý đơn đặt sân',
      bookings: [],             // TODO: thay bằng bookings thật
      currentStatus: status || 'all',
      currentPage: parseInt(page),
      totalPages: 1,            // TODO: Math.ceil(total / limit)
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

    // --- TODO: Bỏ comment khi có model Booking ---
    // const booking = await Booking.findById(id)
    //   .populate('user', 'name email phone')
    //   .populate('field', 'name address pricePerSlot images');
    //
    // if (!booking) {
    //   req.flash('error', 'Không tìm thấy đơn đặt sân!');
    //   return res.redirect('/admin/bookings');
    // }

    res.render('admin/bookings/detail', {
      title: 'Chi tiết đơn đặt sân',
      booking: null, // TODO: thay bằng booking thật
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

    // --- TODO: Bỏ comment khi có model Booking ---
    // const booking = await Booking.findById(id);
    // if (!booking) {
    //   req.flash('error', 'Không tìm thấy đơn!');
    //   return res.redirect('/admin/bookings');
    // }
    //
    // booking.status = 'confirmed';
    // booking.approvedBy = req.session.user._id;
    // booking.approvedAt = new Date();
    // await booking.save();

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

    // --- TODO: Bỏ comment khi có model Booking ---
    // const booking = await Booking.findById(id);
    // if (!booking) {
    //   req.flash('error', 'Không tìm thấy đơn!');
    //   return res.redirect('/admin/bookings');
    // }
    //
    // booking.status = 'rejected';
    // booking.rejectedReason = reason || 'Không đạt yêu cầu';
    // booking.approvedBy = req.session.user._id;
    // await booking.save();

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
    // --- TODO: Bỏ comment khi có model Field ---
    // const fields = await Field.find().sort({ createdAt: -1 });

    res.render('admin/fields/index', {
      title: 'Quản lý sân bóng',
      fields: [], // TODO: thay bằng fields thật
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
    title: 'Thêm sân mới',
  });
};

// POST /admin/fields — Tạo sân mới
const createField = async (req, res) => {
  try {
    const { name, address, type, pricePerSlot, description } = req.body;

    // --- TODO: Bỏ comment khi có model Field ---
    // const field = await Field.create({
    //   name, address, type, pricePerSlot, description,
    //   images: req.files ? req.files.map(f => f.filename) : [],
    // });

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

    // --- TODO: Bỏ comment khi có model Field ---
    // const field = await Field.findById(id);
    // if (!field) {
    //   req.flash('error', 'Không tìm thấy sân!');
    //   return res.redirect('/admin/fields');
    // }

    res.render('admin/fields/edit', {
      title: 'Chỉnh sửa sân',
      field: null, // TODO: thay bằng field thật
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

    // --- TODO: Bỏ comment khi có model Field ---
    // const field = await Field.findByIdAndUpdate(id, {
    //   name, address, type, pricePerSlot, description, status,
    // }, { new: true, runValidators: true });

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

    // --- TODO: Bỏ comment khi có model Field ---
    // await Field.findByIdAndDelete(id);

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
      title: 'Quản lý người dùng',
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
