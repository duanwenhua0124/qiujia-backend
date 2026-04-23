const app = require('../server');

// Vercel Serverless Function Handler
module.exports = async (req, res) => {
  // 确保数据库连接
  await app.connectDB?.();
  
  // 交给Express处理
  return app(req, res);
};
