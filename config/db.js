const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cotton_pest';
  try {
    await mongoose.connect(uri);
    console.log('[DB] MongoDB 已连接:', mongoose.connection.host);
  } catch (err) {
    console.error('[DB] MongoDB 连接失败:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB 运行错误:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB 连接已断开');
  });
}

module.exports = connectDB;
