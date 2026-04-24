const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../db/models');
const { generateToken } = require('../middleware/auth');
const CONFIG = require('../config');

// 直接手机号登录/注册（无需验证码）
router.post('/login', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        code: 400,
        message: '请输入正确的手机号'
      });
    }
    
    // 查找或创建用户
    let user = User.findByPhone(phone);
    if (!user) {
      user = User.create({
        phone,
        points: CONFIG.POINTS.INITIAL_POINTS,
        total_points: CONFIG.POINTS.INITIAL_POINTS,
        nickname: `用户${phone.slice(-4)}`
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
