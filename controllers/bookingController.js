const Booking = require('../models/Booking');
const Field = require('../models/Field');
const TimeSlot = require('../models/TimeSlot');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// Helper: Parse 'YYYY-MM-DD' string as LOCAL midnight (not UTC)
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight
}

// ================================
// GET /checkout — Trang thanh toán
// ================================
const getCheckout = async (req, res) => {
  try {
    const { field: fieldId, slot: slotId, date, start, end } = req.query;

    // Validate params
    if (!fieldId || !slotId || !date || !start || !end) {
      req.flash('error', 'Thiếu thông tin đặt sân! Vui lòng chọn lại.');
      return res.redirect('/fields');
    }

    // Chặn đặt sân trong quá khứ
    const selectedDate = parseLocalDate(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      req.flash('error', 'Lỗi: Không thể đặt sân trong quá khứ!');
      return res.redirect(`/fields/${fieldId}`);
    }

    // Lấy thông tin sân
    const field = await Field.findById(fieldId);
    if (!field) {
      req.flash('error', 'Không tìm thấy sân bóng!');
      return res.redirect('/fields');
    }

    // Lấy thông tin slot
    const slot = await TimeSlot.findById(slotId);
    if (!slot) {
      req.flash('error', 'Không tìm thấy khung giờ!');
      return res.redirect(`/fields/${fieldId}`);
    }

    // Kiểm tra slot còn available không
    if (slot.status !== 'available') {
      req.flash('error', 'Khung giờ này đã có người đặt! Vui lòng chọn khung giờ khác.');
      return res.redirect(`/fields/${fieldId}`);
    }

    res.render('bookings/checkout', {
      title: 'Thanh toán đặt sân',
      activeNav: 'fields',
      field,
      slot,
      bookingDate: date,
      startTime: start,
      endTime: end,
      totalPrice: field.pricePerSlot,
    });
  } catch (error) {
    console.error('Get Checkout Error:', error);
    req.flash('error', 'Lỗi khi tải trang thanh toán!');
    res.redirect('/fields');
  }
};

// ================================
// POST /checkout — Xác nhận đặt sân + upload bill
// Middleware chain: isAuthenticated → upload → preventDoubleBooking → postBooking
// ================================
const postBooking = async (req, res) => {
  try {
    const { fieldId, slotId, bookingDate, startTime, endTime } = req.body;
    const slot = req.bookedSlot; // Từ middleware preventDoubleBooking

    // Lấy giá từ DB — KHÔNG tin client gửi lên (chống hack giá)
    const field = await Field.findById(fieldId);
    if (!field) {
      req.flash('error', 'Không tìm thấy sân bóng!');
      return res.redirect('/fields');
    }
    const totalPrice = field.pricePerSlot;

    // Bắt buộc upload ảnh bill chuyển khoản
    if (!req.file) {
      // Nhả slot về available vì chưa hoàn tất booking
      if (slot) {
        await TimeSlot.findByIdAndUpdate(slot._id, {
          status: 'available',
          bookedBy: null,
        });
      }
      req.flash('error', 'Vui lòng upload ảnh bill chuyển khoản!');
      return res.redirect(`/checkout?field=${fieldId}&slot=${slotId}&date=${bookingDate}&start=${startTime}&end=${endTime}`);
    }

    // Upload ảnh bill lên Cloudinary
    let paymentImageUrl = null;

    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'booking-bills',
          transformation: [
            { width: 800, quality: 'auto' },
          ],
        });
        paymentImageUrl = result.secure_url;

        // Xóa file tạm
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Lỗi xóa file tạm:', err);
        });
      } catch (uploadError) {
        console.error('Cloudinary Upload Error:', uploadError);
        // Xóa file tạm khi upload thất bại (Bug 4 fix)
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Lỗi xóa file tạm trong catch:', err);
        });
        // Vẫn tiếp tục tạo booking, admin sẽ kiểm tra sau
      }
    }

    // Tạo booking mới
    const booking = await Booking.create({
      user: req.session.user._id,
      field: fieldId,
      timeSlot: slotId,
      date: parseLocalDate(bookingDate),
      startTime,
      endTime,
      basePrice: totalPrice,
      finalTotal: totalPrice,
      paymentImage: paymentImageUrl,
      status: 'pending',
    });

    req.flash('success', 'Đặt sân thành công! Đơn của bạn đang chờ Admin duyệt.');
    res.redirect(`/checkout/confirmation/${booking._id}`);
  } catch (error) {
    console.error('Post Booking Error:', error);

    // Nếu tạo booking thất bại, nhả slot về available
    if (req.bookedSlot) {
      try {
        await TimeSlot.findByIdAndUpdate(req.bookedSlot._id, {
          status: 'available',
          bookedBy: null,
        });
      } catch (rollbackError) {
        console.error('Rollback Slot Error:', rollbackError);
      }
    }

    req.flash('error', 'Lỗi khi đặt sân! Vui lòng thử lại.');
    res.redirect('/fields');
  }
};

// ================================
// GET /checkout/confirmation/:id — Trang xác nhận
// ================================
const getConfirmation = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('field', 'name address pricePerSlot type')
      .populate('user', 'name email phone');

    if (!booking) {
      req.flash('error', 'Không tìm thấy đơn đặt sân!');
      return res.redirect('/history');
    }

    // Chỉ cho phép xem đơn của chính mình
    if (booking.user._id.toString() !== req.session.user._id.toString()) {
      req.flash('error', 'Bạn không có quyền xem đơn này!');
      return res.redirect('/history');
    }

    res.render('bookings/confirmation', {
      title: 'Xác nhận đặt sân',
      activeNav: 'history',
      booking,
    });
  } catch (error) {
    console.error('Get Confirmation Error:', error);
    req.flash('error', 'Lỗi khi tải trang xác nhận!');
    res.redirect('/history');
  }
};

// ================================
// GET /history — Lịch sử đặt sân của user
// ================================
const getHistory = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.session.user._id })
      .populate('field', 'name address type')
      .sort({ createdAt: -1 });

    res.render('bookings/history', {
      title: 'Lịch sử đặt sân',
      activeNav: 'history',
      bookings,
    });
  } catch (error) {
    console.error('Get History Error:', error);
    req.flash('error', 'Lỗi khi tải lịch sử đặt sân!');
    res.redirect('/');
  }
};

module.exports = { getCheckout, postBooking, getConfirmation, getHistory };
