const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Checkin = require('../models/Checkin');
const PointTransaction = require('../models/PointTransaction');
const CustomTask = require('../models/CustomTask');
const { auth, admin } = require('../middleware/auth');

// 获取用户信息
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    res.json({
      code: 200,
      data: user
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户信息失败'
    });
  }
});

// 更新头像
router.post('/avatar', auth, async (req, res) => {
  try {
    const { avatar } = req.body;
    
    if (!avatar) {
      return res.status(400).json({
        code: 400,
        message: '头像不能为空'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar },
      { new: true }
    );
    
    res.json({
      code: 200,
      message: '头像更新成功',
      data: { avatar: user.avatar }
    });
  } catch (error) {
    console.error('更新头像失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新头像失败'
    });
  }
});

module.exports = router;
