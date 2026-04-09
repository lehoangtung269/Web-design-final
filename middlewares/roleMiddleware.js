/**
 * Middleware phân quyền theo role
 * Sử dụng: authorizeRole('admin') hoặc authorizeRole('admin', 'manager')
 *
 * Phải đặt SAU authMiddleware.isAuthenticated
 */
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.session.user;

    if (!user) {
      req.flash('error', 'Vui lòng đăng nhập!');
      return res.redirect('/auth/login');
    }

    if (!allowedRoles.includes(user.role)) {
      req.flash('error', 'Bạn không có quyền truy cập trang này!');
      return res.redirect('/');
    }

    next();
  };
};

module.exports = { authorizeRole };
