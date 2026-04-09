const User = require('../models/User');

// ================================
// GET /auth/register — Hiển thị form đăng ký
// ================================
const showRegister = (req, res) => {
  res.render('auth/register', { title: 'Đăng ký' });
};

// ================================
// POST /auth/register — Xử lý đăng ký
// ================================
const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone } = req.body;

    // Kiểm tra mật khẩu xác nhận
    if (password !== confirmPassword) {
      req.flash('error', 'Mật khẩu xác nhận không khớp!');
      return res.redirect('/auth/register');
    }

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'Email này đã được đăng ký!');
      return res.redirect('/auth/register');
    }

    // Tạo user mới (password sẽ tự động hash bởi pre-save hook)
    await User.create({ name, email, password, phone });

    // KHÔNG tự động đăng nhập — redirect về trang login
    req.flash('success', 'Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.');
    return res.redirect('/auth/login');
  } catch (error) {
    // Xử lý lỗi validation từ Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      req.flash('error', messages.join(', '));
      return res.redirect('/auth/register');
    }

    console.error('Register Error:', error);
    req.flash('error', 'Đã xảy ra lỗi, vui lòng thử lại!');
    return res.redirect('/auth/register');
  }
};

// ================================
// GET /auth/login — Hiển thị form đăng nhập
// ================================
const showLogin = (req, res) => {
  res.render('auth/login', { title: 'Đăng nhập' });
};

// ================================
// POST /auth/login — Xử lý đăng nhập
// ================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Tìm user và lấy cả password (vì select: false trong schema)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      req.flash('error', 'Email hoặc mật khẩu không đúng!');
      return res.redirect('/auth/login');
    }

    // Kiểm tra tài khoản bị khóa
    if (!user.isActive) {
      req.flash('error', 'Tài khoản đã bị khóa. Liên hệ admin để biết thêm.');
      return res.redirect('/auth/login');
    }

    // So sánh mật khẩu
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      req.flash('error', 'Email hoặc mật khẩu không đúng!');
      return res.redirect('/auth/login');
    }

    // Lưu thông tin vào session
    req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    req.flash('success', `Xin chào, ${user.name}!`);

    // Admin → redirect về dashboard, User → redirect về trang chủ
    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/');
  } catch (error) {
    console.error('Login Error:', error);
    req.flash('error', 'Đã xảy ra lỗi, vui lòng thử lại!');
    return res.redirect('/auth/login');
  }
};

// ================================
// GET /auth/logout — Đăng xuất
// ================================
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout Error:', err);
    }
    res.clearCookie('connect.sid');
    return res.redirect('/auth/login');
  });
};

module.exports = { showRegister, register, showLogin, login, logout };
