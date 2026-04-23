module.exports = {
  apps: [{
    name: 'qiujia-backend',
    script: 'server.js',
    cwd: '/app/data/所有对话/主对话/打卡APP/backend',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
