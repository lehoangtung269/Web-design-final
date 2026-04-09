// Tập trung tất cả biến môi trường vào một chỗ
// Dễ dàng kiểm tra và có giá trị mặc định

module.exports = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/web_design_final',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Bcrypt
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10,

  // CORS
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  // Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  uploadPath: process.env.UPLOAD_PATH || 'backend/uploads/',
};
