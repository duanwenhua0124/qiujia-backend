const jwt = require('jsonwebtoken');
const { User } = require('../db/models');

// 验证Token中间件
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        code: 401,
        message: '请先登录'
      });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        code: 401,
        message: '用户不存在'
      });
    }
    
    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 401,
        message: '登录已过期，请重新登录'
      });
    }
    return res.status(401).json({
      code: 401,
      message: '无效的登录凭证'
    });
  }
};

// 管理员权限中间件
const admin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      code: 403,
      message: '需要管理员权限'
    });
  }
  next();
};

// 生成Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = { auth, admin, generateToken };
