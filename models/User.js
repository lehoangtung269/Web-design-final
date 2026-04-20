const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập họ tên'],
      trim: true,
      minlength: [2, 'Họ tên phải ít nhất 2 ký tự'],
      maxlength: [50, 'Họ tên không quá 50 ký tự'],
    },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'],
    },
    password: {
      type: String,
      required: [true, 'Vui lòng nhập mật khẩu'],
      minlength: [6, 'Mật khẩu phải ít nhất 6 ký tự'],
      select: false, // Không trả về password khi query
    },
    phone: {
      type: String,
      required: [true, 'Vui lòng nhập số điện thoại'],
      trim: true,
      match: [/^(0[3|5|7|8|9])+([0-9]{8})$/, 'Số điện thoại không hợp lệ (VD: 0912345678)'],
    },
    role: {
      type: String,
      enum: ['user', 'field_owner', 'admin'],
      default: 'user',
    },
    commissionRate: {
      type: Number,
      min: 2,
      max: 10,
      default: 5,
      required: function () {
        return this.role === 'field_owner';
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

// ================================
// Hash mật khẩu trước khi lưu
// ================================
userSchema.pre('save', async function () {
  // Chỉ hash khi mật khẩu thay đổi
  if (!this.isModified('password')) return;

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
  this.password = await bcrypt.hash(this.password, saltRounds);
});

// ================================
// Method: So sánh mật khẩu khi đăng nhập
// ================================
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ================================
// Method: Trả về user KHÔNG có password
// ================================
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
