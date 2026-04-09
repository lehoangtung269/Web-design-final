const jwt = require('jsonwebtoken');

/**
 * Middleware xác thực JWT token
 * Sử dụng cho các route cần đăng nhập
 */
const protect = (req, res, next) => {
  try {
    // Lấy token từ header Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '❌ Không có quyền truy cập. Vui lòng đăng nhập!',
      });
    }

    const token = authHeader.split(' ')[1];

    // Xác minh token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Gắn thông tin user vào request
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '❌ Token không hợp lệ hoặc đã hết hạn!',
    });
  }
};

/**
 * Middleware phân quyền theo role
 * Ví dụ: authorize('admin') hoặc authorize('admin', 'manager')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `❌ Role '${req.user.role}' không có quyền thực hiện hành động này!`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
