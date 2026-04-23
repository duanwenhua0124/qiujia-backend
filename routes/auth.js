const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../db/models');
const { generateToken } = require('../middleware/auth');
const CONFIG = require('../config');

// 模拟验证码存储（生产环境应使用Redis）
const verificationCodes = new Map();

// 发送验证码
router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        code: 400,
        message: '请输入正确的手机号'
      });
    }
    
    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 存储验证码（5分钟有效）
    verificationCodes.set(phone, {
      code,
      expiresAt: Date.now() + CONFIG.SMS.EXPIRES_IN * 1000
    });
    
    // TODO: 调用短信服务发送验证码
    // 这里模拟发送成功
    console.log(`[模拟] 验证码 ${code} 已发送到 ${phone}`);
    
    res.json({
      code: 200,
      message: '验证码已发送',
      data: {
        expires_in: CONFIG.SMS.EXPIRES_IN,
        // 开发环境返回验证码方便测试
        debug_code: code
      }
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({
      code: 500,
      message: '发送验证码失败'
    });
  }
});

// 验证码登录/注册
router.post('/login', async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({
        code: 400,
        message: '手机号和验证码不能为空'
      });
    }
    
    // 验证验证码
    const stored = verificationCodes.get(phone);
    if (!stored || stored.code !== code) {
      return res.status(400).json({
        code: 400,
        message: '验证码错误'
      });
    }
    if (Date.now() > stored.expiresAt) {
      return res.status(400).json({
        code: 400,
        message: '验证码已过期'
      });
    }
    
    // 清除验证码
    verificationCodes.delete(phone);
    
    // 查找或创建用户
    let user = User.findByPhone(phone);
    if (!user) {
      user = User.create({
        phone,
        points: CONFIG.POINTS.INITIAL_POINTS,
        total_points: CONFIG.POINTS.INITIAL_POINTS
      });
    }
    
    // 生成Token
    const token = generateToken(user.id);
    
    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          _id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar,
          points: user.points,
          total_points: user.total_points,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      code: 500,
      message: '登录失败'
    });
  }
});

// 更新用户资料
router.put('/profile', require('../middleware/auth').auth, async (req, res) => {
  try {
    const { nickname, avatar } = req.body;
    const updates = {};
    
    if (nickname) updates.nickname = nickname;
    if (avatar !== undefined) updates.avatar = avatar;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        code: 400,
        message: '没有需要更新的字段'
      });
    }
    
    User.updateById(req.userId, updates);
    const user = User.findById(req.userId);
    
    res.json({
      code: 200,
      message: '更新成功',
      data: user
    });
  } catch (error) {
    console.error('更新资料失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新失败'
    });
  }
});

module.exports = router;
