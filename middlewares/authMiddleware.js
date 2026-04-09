/**
 * Middleware kiểm tra user đã đăng nhập chưa (qua session)
 */
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    // Gắn thông tin user vào res.locals để EJS dùng được
    res.locals.currentUser = req.session.user;
    return next();
  }

  req.flash('error', 'Vui lòng đăng nhập để tiếp tục!');
  return res.redirect('/auth/login');
};

/**
 * Middleware kiểm tra user CHƯA đăng nhập
 * (dùng cho trang login/register — đã login rồi thì redirect về home)
 */
const isGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  return next();
};

/**
 * Middleware gắn user info vào tất cả views (dùng global)
 * Dùng ở app.js: app.use(setLocals)
 */
const setLocals = (req, res, next) => {
  res.locals.currentUser = req.session ? req.session.user : null;
  res.locals.success = req.flash ? req.flash('success') : [];
  res.locals.error = req.flash ? req.flash('error') : [];
  next();
};

module.exports = { isAuthenticated, isGuest, setLocals };
