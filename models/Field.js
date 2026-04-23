const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập tên sân'],
      trim: true,
      maxlength: [100, 'Tên sân không quá 100 ký tự'],
    },
    address: {
      type: String,
      required: [true, 'Vui lòng nhập địa chỉ sân'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'Vui lòng nhập thành phố'],
      trim: true,
    },
    district: {
      type: String,
      required: [true, 'Vui lòng nhập quận/huyện'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Vui lòng chọn loại sân'],
      enum: {
        values: ['5-a-side', '7-a-side', '11-a-side'],
        message: 'Loại sân phải là 5-a-side, 7-a-side hoặc 11-a-side',
      },
    },
    pricePerSlot: {
      type: Number,
      required: [true, 'Vui lòng nhập giá thuê sân'],
      min: [0, 'Giá không được âm'],
    },
    images: [
      {
        type: String, // URL ảnh từ Cloudinary
      },
    ],
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'deleted'],
      default: 'active',
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    approvalNote: {
      type: String,
      trim: true,
      default: '',
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
    submittedByOwner: {
      type: Boolean,
      default: false,
    },
    facilities: {
      type: [String],
      default: [],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    fieldCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index để tìm kiếm nhanh
fieldSchema.index({ type: 1, status: 1 });
fieldSchema.index({ city: 1, district: 1, status: 1 });
fieldSchema.index({ owner: 1, approvalStatus: 1, status: 1 });
fieldSchema.index({ name: 'text', address: 'text' });

const Field = mongoose.model('Field', fieldSchema);

module.exports = Field;
