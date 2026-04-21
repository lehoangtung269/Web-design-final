const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendBookingConfirmationAsync = async (to, booking) => {
    // Fallback dev mode nếu không có SMTP
    if (process.env.NODE_ENV !== 'production' && !process.env.EMAIL_USER) {
        console.log(`[DEV EMAIL] Gửi đến ${to} | Đơn #${booking._id} | Trạng thái: ${booking.status}`);
        return;
    }

    const statusText = booking.status === 'confirmed' ? '✅ Đã được duyệt' : booking.status === 'rejected' ? '❌ Đã từ chối' : '⏳ Đang chờ duyệt';
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `Thông báo đơn đặt sân #${booking._id.toString().slice(-6)}`,
        html: `
      <h2>Chào ${booking.user?.name || 'bạn'},</h2>
      <p>Đơn đặt sân <strong>${booking.field?.name}</strong> ngày <strong>${booking.date.toLocaleDateString('vi-VN')}</strong> 
      khung giờ <strong>${booking.startTime} - ${booking.endTime}</strong></p>
      <p style="font-weight:bold; color:${booking.status === 'confirmed' ? 'green' : 'red'}">Trạng thái: ${statusText}</p>
      <hr><p style="font-size:12px;color:#666">Đây là email tự động từ Hệ thống ĐặtSân.vn</p>
    `
    };
    return transporter.sendMail(mailOptions);
};

module.exports = { sendBookingConfirmationAsync };
