const TimeSlot = require('../models/TimeSlot');

/**
 * Middleware: Chống trùng lịch (Double Booking)
 * 
 * Sử dụng findOneAndUpdate ATOMIC của MongoDB:
 * - Chỉ cập nhật slot nếu status = 'available'
 * - Nếu 2 request đến cùng lúc, chỉ 1 thành công
 * - Request còn lại nhận null → báo lỗi
 */
const preventDoubleBooking = async (req, res, next) => {
  try {
    const { slotId } = req.body;

    if (!slotId) {
      req.flash('error', 'Thiếu thông tin khung giờ!');
      return res.redirect('back');
    }

    // ================================
    // ATOMIC OPERATION — Quan trọng nhất!
    // Tìm slot có _id = slotId VÀ status = 'available'
    // Nếu tìm thấy → cập nhật status = 'pending' + bookedBy
    // Nếu không tìm thấy (đã bị đặt) → trả về null
    // ================================
    const slot = await TimeSlot.findOneAndUpdate(
      {
        _id: slotId,
        status: 'available', // Chỉ lấy slot TRỐNG
      },
      {
        $set: {
          status: 'pending',
          bookedBy: req.session.user._id,
        },
      },
      {
        new: true, // Trả về document sau khi update
      }
    );

    // Nếu null → slot đã bị người khác đặt trước
    if (!slot) {
      req.flash('error', 'Xin lỗi, khung giờ này vừa có người đặt! Vui lòng chọn khung giờ khác.');
      
      // Lấy fieldId từ body để redirect về trang chi tiết sân
      const { fieldId } = req.body;
      if (fieldId) {
        return res.redirect(`/fields/${fieldId}`);
      }
      return res.redirect('/fields');
    }

    // Thành công → gắn slot vào request để controller dùng
    req.bookedSlot = slot;
    next();
  } catch (error) {
    console.error('Prevent Double Booking Error:', error);
    req.flash('error', 'Lỗi hệ thống khi kiểm tra khung giờ!');
    return res.redirect('/fields');
  }
};

module.exports = { preventDoubleBooking };
