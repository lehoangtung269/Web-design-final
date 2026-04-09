const session = require('express-session');
const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.default || connectMongo;

// ================================
// Cấu hình Session lưu vào MongoDB
// ================================
const sessionConfig = session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'football-booking-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // Session hết hạn sau 1 ngày (giây)
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 ngày (mili giây)
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Chỉ bật HTTPS khi production
    sameSite: 'lax',
  },
});

module.exports = sessionConfig;
