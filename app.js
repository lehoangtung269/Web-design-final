const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const sessionConfig = require('./config/session');
const { setLocals } = require('./middlewares/authMiddleware');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { startCleanupInterval } = require('./utils/cleanupPendingSlots');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const homeRoutes = require('./routes/homeRoutes');
const fieldRoutes = require('./routes/fieldRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const profileRoutes = require('./routes/profileRoutes');
const apiRoutes = require('./routes');

// ================================
// Khởi tạo app
// ================================
const app = express();

// ================================
// Kết nối Database
// ================================
connectDB();

// Khởi động cleanup: tự nhả slot pending bị kẹt sau 15 phút
startCleanupInterval();

// ================================
// View Engine (EJS) + Layout System
// ================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// ================================
// Middlewares toàn cục
// ================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ file tĩnh
app.use('/uploads', express.static(path.join(__dirname, 'backend/uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ================================
// Session & Flash Messages
// ================================
app.use(sessionConfig);
app.use(flash());

// ================================
// CSRF Protection
// ================================
const csrf = require('csurf');
const csrfProtection = csrf();
app.use((req, res, next) => {
  // Bỏ qua CSRF cho multipart/form-data (upload file) — multer xử lý trước csurf
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return next();
  }
  csrfProtection(req, res, next);
});

// Gắn user + flash messages + CSRF token vào tất cả views
app.use(setLocals);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
});

// ================================
// Routes
// ================================
app.use('/', homeRoutes);
app.use('/fields', fieldRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/owner', ownerRoutes);
app.use('/', bookingRoutes);
app.use('/', profileRoutes);
app.use('/api', apiRoutes);

// ================================
// Error Handlers
// ================================
app.use(notFound);
app.use(errorHandler);

// ================================
// Khởi động server
// ================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📦 Môi trường: ${process.env.NODE_ENV}`);
});

module.exports = app;
