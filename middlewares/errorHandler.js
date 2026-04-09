/**
 * Middleware xử lý route không tồn tại (404)
 */
const notFound = (req, res, next) => {
  const error = new Error(`❌ Không tìm thấy route: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Middleware xử lý lỗi toàn cục
 * Phải có đủ 4 tham số (err, req, res, next) để Express nhận diện là error handler
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ nội bộ';

  // Lỗi Mongoose: ID không hợp lệ
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `❌ ID không hợp lệ: ${err.value}`;
  }

  // Lỗi Mongoose: Trùng lặp dữ liệu (ví dụ: email đã tồn tại)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `❌ Giá trị '${err.keyValue[field]}' đã tồn tại trong trường '${field}'`;
  }

  // Lỗi Mongoose: Validation
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  // Lỗi JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '❌ Token không hợp lệ!';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = '❌ Token đã hết hạn!';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Chỉ hiển thị stack trace khi đang dev
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
