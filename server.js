require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 导入数据库（初始化SQLite）
require('./db/init');

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 导入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const taskRoutes = require('./routes/tasks');
const pointsRoutes = require('./routes/points');
const adminRoutes = require('./routes/admin');
const rewardsRoutes = require('./routes/rewards');

// 路由
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/points', pointsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/rewards', rewardsRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'sqlite', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    code: 500,
    message: '服务器内部错误'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '接口不存在'
  });
});

// 本地开发时启动服务器
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('🚀 服务器运行在 http://localhost:' + PORT);
    console.log('📚 API文档 http://localhost:' + PORT + '/api/v1');
    console.log('🗄️  数据库: SQLite');
  });
}

module.exports = app;
