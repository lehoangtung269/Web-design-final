const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Booking phải có người đặt'],
    },
    field: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      required: [true, 'Booking phải có sân bóng'],
    },
    timeSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimeSlot',
      required: [true, 'Booking phải có khung giờ'],
    },
    date: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày đá'],
    },
    startTime: {
      type: String, // VD: "19:00"
      required: [true, 'Vui lòng nhập giờ bắt đầu'],
    },
    endTime: {
      type: String, // VD: "20:30"
      required: [true, 'Vui lòng nhập giờ kết thúc'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Vui lòng nhập giá tiền'],
      min: [0, 'Giá không được âm'],
    },
    paymentImage: {
      type: String, // URL ảnh bill chuyển khoản (Cloudinary)
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected'],
      default: 'pending',
    },
    rejectedReason: {
      type: String,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

// ================================
// Index để query nhanh
// ================================
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ field: 1, date: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
