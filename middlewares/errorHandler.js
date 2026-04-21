const notFound = (req, res, next) => {
  const error = new Error(`Không tìm thấy trang: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ nội bộ';

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `ID không hợp lệ: ${err.value}`;
  }
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Giá trị '${err.keyValue[field]}' đã tồn tại trong trường '${field}'`;
  }
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((val) => val.message).join(', ');
  }
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token không hợp lệ!';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token đã hết hạn!';
  }

  // Nếu là API request → trả JSON như cũ
  const isApiRequest = req.originalUrl.startsWith('/api') ||
    (req.headers.accept && req.headers.accept.includes('application/json'));

  if (isApiRequest) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // Còn lại → render trang lỗi EJS
  res.status(statusCode).render('error', {
    title: `Lỗi ${statusCode}`,
    statusCode,
    message,
    layout: 'layouts/main',
  });
};

module.exports = { notFound, errorHandler };
