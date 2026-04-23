const User = require('../models/User');

const refreshSessionUser = async (req, res) => {
  if (!req.session?.user?._id) {
    req.currentUser = null;
    return null;
  }

  if (req.currentUser) {
    if (res) {
      res.locals.currentUser = req.currentUser;
    }
    return req.currentUser;
  }

  const freshUser = await User.findById(req.session.user._id)
    .select('_id name email phone role isActive')
    .lean();

  if (!freshUser || !freshUser.isActive) {
    if (req.session) {
      delete req.session.user;
    }
    req.currentUser = null;
    if (res) {
      res.locals.currentUser = null;
    }
    return null;
  }

  req.session.user = {
    _id: freshUser._id,
    name: freshUser.name,
    email: freshUser.email,
    phone: freshUser.phone,
    role: freshUser.role,
  };
  req.currentUser = req.session.user;

  if (res) {
    res.locals.currentUser = req.currentUser;
  }

  return req.currentUser;
};

/**
 * Middleware kiểm tra user đã đăng nhập chưa (qua session)
 */
const isAuthenticated = async (req, res, next) => {
  try {
    const currentUser = await refreshSessionUser(req, res);
    if (currentUser) {
      return next();
    }
  } catch (error) {
    console.error('Auth Middleware Error:', error);
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
const setLocals = async (req, res, next) => {
  try {
    await refreshSessionUser(req, res);
  } catch (error) {
    console.error('Refresh Session User Error:', error);
    res.locals.currentUser = req.session ? req.session.user : null;
  }

  res.locals.success = req.flash ? req.flash('success') : [];
  res.locals.error = req.flash ? req.flash('error') : [];
  next();
};

module.exports = { isAuthenticated, isGuest, setLocals };
