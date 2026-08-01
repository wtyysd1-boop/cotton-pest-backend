require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// 路由
const areasRouter = require('./routes/areas');
const reportsRouter = require('./routes/reports');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 中间件 ──
app.disable('x-powered-by');
app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志（开发用）
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleString('zh-CN')}] ${req.method} ${req.url}`);
    next();
  });
}

// ── API 路由 ──
app.use('/api/areas', areasRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/stats', statsRouter);

// ── 静态文件（前端页面） ──
const siblingFrontend = path.join(__dirname, '..', 'frontend');
const frontendPath = fs.existsSync(siblingFrontend) ? siblingFrontend : path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

// 上传图片静态目录
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// 前端入口：自动返回 index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ code: 404, message: '接口不存在' });
  }
  const indexFile = path.join(frontendPath, 'index.html');
  if (!fs.existsSync(indexFile)) {
    return res.status(404).json({ code: 404, message: '前端页面未部署，请检查 frontend 目录' });
  }
  res.sendFile(indexFile);
});

// ── 错误处理 ──
app.use(errorHandler);

// ── 启动 ──
async function start() {
  // 连接 MongoDB
  await connectDB();

  app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================');
    console.log('  棉花病虫害智能识别系统 - 后端服务');
    console.log('  ==========================================');
    console.log(`  🚀 服务已启动: http://localhost:${PORT}`);
    console.log('  📋 API 接口:');
    console.log('     GET  /api/areas          - 获取区域列表');
    console.log('     POST /api/reports/submit - 虫害上报（自动获取天气）');
    console.log('     GET  /api/stats/region/:areaId?range=1d|3d|7d');
    console.log('  ==========================================');
    console.log('  前端页面: http://localhost:' + PORT);
    console.log('  环境: ' + (process.env.NODE_ENV || 'development'));
    console.log('  MongoDB: ' + (process.env.MONGODB_URI ? '已配置' : '未配置'));
    console.log('  API Key: ' + (process.env.API_KEY ? '已配置' : '使用开发默认值'));
    console.log('  和风天气: ' + (process.env.QWEATHER_KEY ? '已配置' : '未配置'));
    console.log('============================================');
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
