const User = require('../models/User');
const Booking = require('../models/Booking');

// ================================
// GET /profile — Trang hồ sơ cá nhân
// ================================
const getProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;

    // Lấy thông tin user từ DB (fresh data)
    const user = await User.findById(userId);
    if (!user) {
      req.flash('error', 'Không tìm thấy tài khoản!');
      return res.redirect('/');
    }

    // Thống kê booking
    const [totalBookings, pendingBookings, confirmedBookings, recentBookings] =
      await Promise.all([
        Booking.countDocuments({ user: userId }),
        Booking.countDocuments({ user: userId, status: 'pending' }),
        Booking.countDocuments({ user: userId, status: 'confirmed' }),
        Booking.find({ user: userId })
          .populate('field', 'name address type')
          .sort({ createdAt: -1 })
          .limit(5),
      ]);

    res.render('profile/profile', {
      title: 'Hồ sơ cá nhân',
      activeNav: 'profile',
      profileUser: user,
      stats: {
        total: totalBookings,
        pending: pendingBookings,
        confirmed: confirmedBookings,
      },
      recentBookings,
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    req.flash('error', 'Lỗi khi tải trang hồ sơ!');
    res.redirect('/');
  }
};

// ================================
// POST /profile/update — Cập nhật thông tin cá nhân
// ================================
const updateProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { name, phone } = req.body;

    // Validate
    if (!name || !name.trim()) {
      req.flash('error', 'Vui lòng nhập họ tên!');
      return res.redirect('/profile');
    }

    if (!phone || !phone.trim()) {
      req.flash('error', 'Vui lòng nhập số điện thoại!');
      return res.redirect('/profile');
    }

    // Cập nhật user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name: name.trim(), phone: phone.trim() },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      req.flash('error', 'Không tìm thấy tài khoản!');
      return res.redirect('/profile');
    }

    // Cập nhật session với thông tin mới
    req.session.user.name = updatedUser.name;
    req.session.user.phone = updatedUser.phone;

    req.flash('success', 'Cập nhật thông tin thành công!');
    return res.redirect('/profile');
  } catch (error) {
    console.error('Update Profile Error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      req.flash('error', messages.join(', '));
      return res.redirect('/profile');
    }

    req.flash('error', 'Lỗi khi cập nhật thông tin!');
    return res.redirect('/profile');
  }
};

// ================================
// POST /profile/change-password — Đổi mật khẩu
// ================================
const changePassword = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      req.flash('error', 'Vui lòng điền đầy đủ thông tin!');
      return res.redirect('/profile');
    }

    if (newPassword !== confirmNewPassword) {
      req.flash('error', 'Mật khẩu mới và xác nhận không khớp!');
      return res.redirect('/profile');
    }

    if (newPassword.length < 6) {
      req.flash('error', 'Mật khẩu mới phải ít nhất 6 ký tự!');
      return res.redirect('/profile');
    }

    // Lấy user kèm password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      req.flash('error', 'Không tìm thấy tài khoản!');
      return res.redirect('/profile');
    }

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      req.flash('error', 'Mật khẩu hiện tại không đúng!');
      return res.redirect('/profile');
    }

    // Đổi mật khẩu (pre-save hook sẽ hash)
    user.password = newPassword;
    await user.save();

    req.flash('success', 'Đổi mật khẩu thành công!');
    return res.redirect('/profile');
  } catch (error) {
    console.error('Change Password Error:', error);
    req.flash('error', 'Lỗi khi đổi mật khẩu!');
    return res.redirect('/profile');
  }
};

module.exports = { getProfile, updateProfile, changePassword };
