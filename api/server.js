// Vercel Serverless Entry Point
// 导入数据库初始化
require('../db/init');
module.exports = require('../server');
