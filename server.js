require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// 路由
const areasRouter = require('./routes/areas');
const reportsRouter = require('./routes/reports');
const statsRouter = require('./routes/stats');
const uploadRouter = require('./routes/upload');

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
app.use('/api/upload', uploadRouter);

// 健康检查（用于部署监控/保活）
app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { uptime: process.uptime() } });
});

// ── 图片上传接口 ──
function parseMultipart(buffer, boundary) {
  const delimiter = Buffer.from('--' + boundary);
  const results = [];
  let pos = 0;
  for (;;) {
    const start = buffer.indexOf(delimiter, pos);
    if (start === -1) break;
    const lineEnd = buffer.indexOf(Buffer.from('\r\n'), start + delimiter.length);
    if (lineEnd === -1) break;
    const partStart = lineEnd + 2;
    const next = buffer.indexOf(delimiter, partStart);
    if (next === -1) break;
    let partEnd = next;
    if (buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) partEnd -= 2;
    const block = buffer.slice(partStart, partEnd);
    const sep = block.indexOf(Buffer.from('\r\n\r\n'));
    if (sep === -1) { pos = next + delimiter.length; continue; }
    const headers = block.slice(0, sep).toString('utf8');
    const data = block.slice(sep + 4);
    const nameMatch = /name="([^"]*)"/.exec(headers);
    const fileMatch = /filename="([^"]*)"/.exec(headers);
    if (nameMatch && nameMatch[1] === 'file' && fileMatch) {
      results.push({ filename: fileMatch[1], data });
    }
    pos = next + delimiter.length;
  }
  return results;
}

app.post('/upload/image', express.raw({ type: 'multipart/form-data', limit: '20mb' }), (req, res, next) => {
  try {
    const ct = req.headers['content-type'] || '';
    const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
    if (!bm) return res.status(400).json({ code: 400, message: '缺少 multipart boundary' });
    const boundary = bm[1] || bm[2];
    const files = parseMultipart(req.body, boundary);
    if (!files.length) return res.status(400).json({ code: 400, message: '没有收到文件' });
    const f = files[0];
    const extMatch = /\.([a-zA-Z0-9]+)$/.exec(f.filename);
    const ext = extMatch ? extMatch[1] : 'jpg';
    const filename = crypto.randomUUID() + '.' + ext;
    const uploadsDir = path.join(__dirname, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, filename), f.data);
    res.json({
      code: 0,
      url: (process.env.PUBLIC_URL || 'https://cotton-pest-backend.onrender.com') + '/uploads/' + filename
    });
  } catch (err) {
    next(err);
  }
});

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
