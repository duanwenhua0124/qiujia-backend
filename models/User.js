const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    default: null // 验证码登录时为空
  },
  nickname: {
    type: String,
    default: '新用户'
  },
  avatar: {
    type: String,
    default: ''
  },
  points: {
    type: Number,
    default: 100
  },
  total_points: {
    type: Number,
    default: 100
  },
  // 连续打卡天数
  checkin_streak: {
    type: Number,
    default: 0
  },
  // 最长连续打卡天数
  max_checkin_streak: {
    type: Number,
    default: 0
  },
  // 上次打卡日期
  last_checkin_date: {
    type: String,
    default: null
  },
  // 累计打卡天数
  total_checkin_days: {
    type: Number,
    default: 0
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true
});

// 密码加密
userSchema.pre('save', async function(next) {
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// 密码比对
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// 转化为JSON时隐藏密码
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
