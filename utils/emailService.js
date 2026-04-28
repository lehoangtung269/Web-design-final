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

// Gửi email cho User khi Đặt Sân thành công (Pending)
const sendNewBookingUserEmail = async (userEmail, booking) => {
    if (process.env.NODE_ENV !== 'production' && !process.env.EMAIL_USER) {
        console.log(`[DEV INFO] Giả lập gửi email xác nhận đặt sân cho User: ${userEmail}. BookingCode: ${booking.bookingCode}`);
        return;
    }

    const htmlContent = `
        <h2>Chào ${booking.user.name},</h2>
        <p>Cảm ơn bạn đã đặt sân qua hệ thống DatSan.vn. Đơn của bạn đã được ghi nhận và đang chờ duyệt.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p><strong>Mã đặt sân tại sân (Booking Code):</strong> <span style="font-size: 18px; color: #6a37d3; font-weight: bold;">${booking.bookingCode}</span></p>
            <p><strong>Tên sân:</strong> ${booking.field.name}</p>
            <p><strong>Ngày giờ đặt:</strong> ${booking.startTime} - ${booking.endTime} | ${booking.date.toLocaleDateString('vi-VN')}</p>
            <p><strong>Tổng tiền:</strong> ${booking.totalPrice.toLocaleString('vi-VN')} VNĐ</p>
        </div>
        <p>Admin / Chủ sân đang kiểm tra biên lai và sẽ sớm duyệt đơn cho bạn.</p>
        <hr>
        <p style="font-size:12px;color:#666">Vui lòng đưa Mã đặt sân (Booking Code) cho quản lý sân khi bạn đến nhận sân.</p>
    `;

    return transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `[DatSan.vn] Xác nhận đặt sân thành công - Mã: ${booking.bookingCode}`,
        html: htmlContent
    });
};

// Gửi email cho Chủ Sân khi có đơn mới
const sendNewBookingOwnerEmail = async (ownerEmail, booking) => {
    if (!ownerEmail) return;

    if (process.env.NODE_ENV !== 'production' && !process.env.EMAIL_USER) {
        console.log(`[DEV INFO] Giả lập gửi email thông báo đơn mới cho Owner: ${ownerEmail}. Booking: ${booking._id}`);
        return;
    }

    const htmlContent = `
        <h2>Có đơn đặt sân mới!</h2>
        <p><strong>Khách hàng:</strong> ${booking.user.name} (${booking.user.phone})</p>
        <p><strong>Sân:</strong> ${booking.field.name}</p>
        <p><strong>Ngày giờ:</strong> ${booking.startTime} - ${booking.endTime} | ${booking.date.toLocaleDateString('vi-VN')}</p>
        <p><strong>Tổng tiền:</strong> ${booking.totalPrice.toLocaleString('vi-VN')} VNĐ</p>
        <p>Vui lòng đăng nhập vào trang quản trị để kiểm tra biên lai và duyệt đơn.</p>
    `;

    return transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: ownerEmail,
        subject: `[DatSan.vn] Có đơn đặt sân mới tại ${booking.field.name}`,
        html: htmlContent
    });
};

module.exports = {
    sendBookingConfirmationAsync,
    sendNewBookingUserEmail,
    sendNewBookingOwnerEmail
};
