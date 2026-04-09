const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const flash = require('connect-flash');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const sessionConfig = require('./config/session');
const { setLocals } = require('./middlewares/authMiddleware');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes');

// ================================
// Khởi tạo app
// ================================
const app = express();

// ================================
// Kết nối Database
// ================================
connectDB();

// ================================
// View Engine (EJS)
// ================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

// Gắn user + flash messages vào tất cả views
app.use(setLocals);

// ================================
// Routes
// ================================
app.get('/', (req, res) => {
  res.render('home/index', { title: 'Trang chủ' });
});

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
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
