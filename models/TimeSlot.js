const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema(
  {
    field: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      required: [true, 'Vui lòng chọn sân'],
    },
    date: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày'],
    },
    startTime: {
      type: String, // VD: "07:00"
      required: [true, 'Vui lòng nhập giờ bắt đầu'],
    },
    endTime: {
      type: String, // VD: "08:30"
      required: [true, 'Vui lòng nhập giờ kết thúc'],
    },
    status: {
      type: String,
      enum: ['available', 'pending', 'booked'],
      default: 'available',
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ================================
// Compound index: tránh trùng lịch (Double Booking)
// Mỗi sân + ngày + giờ bắt đầu chỉ có DUY NHẤT 1 slot
// ================================
timeSlotSchema.index({ field: 1, date: 1, startTime: 1 }, { unique: true });

// ================================
// Static: Tự tạo slots cho 1 ngày nếu chưa có
// Giờ mặc định: 06:00 đến 23:00, mỗi slot 1.5 giờ
// ================================
timeSlotSchema.statics.generateSlotsForDate = async function (fieldId, date) {
  // Chuẩn hóa ngày (bỏ giờ phút giây)
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // Kiểm tra đã có slot cho ngày này chưa
  const existingSlots = await this.find({ field: fieldId, date: targetDate });
  if (existingSlots.length > 0) {
    return existingSlots;
  }

  // Tạo các khung giờ: 06:00-07:30, 07:30-09:00, ..., 21:30-23:00
  const slots = [];
  const startHours = [6, 7.5, 9, 10.5, 12, 13.5, 15, 16.5, 18, 19.5, 21];

  for (const startHour of startHours) {
    const endHour = startHour + 1.5;
    const startTime = formatTime(startHour);
    const endTime = formatTime(endHour);

    slots.push({
      field: fieldId,
      date: targetDate,
      startTime,
      endTime,
      status: 'available',
    });
  }

  try {
    const createdSlots = await this.insertMany(slots, { ordered: false });
    return createdSlots;
  } catch (error) {
    // Nếu bị trùng (race condition), lấy lại từ DB
    if (error.code === 11000) {
      return await this.find({ field: fieldId, date: targetDate }).sort({ startTime: 1 });
    }
    throw error;
  }
};

// ================================
// Helper: Format giờ từ số thành chuỗi "HH:MM"
// ================================
function formatTime(hour) {
  const h = Math.floor(hour);
  const m = (hour - h) * 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);

module.exports = TimeSlot;
