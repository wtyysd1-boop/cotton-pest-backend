# 棉花病虫害智能识别系统 - 后端服务

基于 Node.js + Express + MongoDB + 和风天气 的虫害监测后端。

---

## 📋 系统要求

- Node.js >= 18
- MongoDB >= 6.0（本地实例或 MongoDB Atlas）
- npm >= 9

---

## 🚀 本地运行步骤

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

打开 `.env`，修改以下值：

| 变量 | 说明 | 必填 |
|------|------|------|
| `MONGODB_URI` | MongoDB 连接串（本地或 Atlas） | 是 |
| `QWEATHER_KEY` | 和风天气 API Key | 是（否则天气数据为 null） |
| `PORT` | 服务端口，默认 3000 | 否 |

#### MongoDB 配置示例

**本地 MongoDB：**
```
MONGODB_URI=mongodb://localhost:27017/cotton_pest
```

**MongoDB Atlas（你的连接串）：**
```
MONGODB_URI=mongodb+srv://wtyysd1_db_user:VS0iJcH7ROQ3E8zh@cluster0.z85yf8w.mongodb.net/cotton_pest?retryWrites=true&w=majority
```

#### 和风天气配置

1. 前往 https://dev.qweather.com 注册账号
2. 创建免费订阅（"免费订阅"即可，每天 1000 次调用额度）
3. 获取 API Key
4. 填入 `.env` 的 `QWEATHER_KEY`

### 3. 导入种子数据

```bash
npm run seed
```

这会：
- 向 MongoDB 写入 14 个湖南省地市区域数据
- 生成约 900 条模拟虫害上报记录（覆盖近 7 天）

### 4. 启动服务

```bash
npm start
```

或开发模式（热重载）：
```bash
npm run dev
```

### 5. 验证运行

在浏览器打开 http://localhost:3000

**API 测试：**
```bash
# 获取区域列表
curl http://localhost:3000/api/areas

# 获取全省近7天统计
curl "http://localhost:3000/api/stats/region/all?range=7d"

# 查看长沙近24小时统计
curl "http://localhost:3000/api/stats/region/430100?range=1d"
```

---

## 📡 API 接口文档

### GET /api/areas

返回湖南省 14 个地市列表。

**响应示例：**
```json
{
  "code": 0,
  "data": [
    { "id": "430100", "name": "长沙市", "center": [112.94, 28.23] },
    { "id": "430200", "name": "株洲市", "center": [113.13, 27.83] }
  ]
}
```

### POST /api/reports/submit

提交一条虫害识别结果。后端会自动根据坐标调和风天气 API 补全气温、湿度、天气现象。

**请求体：**
```json
{
  "areaId": 430100,
  "location": {
    "type": "Point",
    "coordinates": [112.9456, 28.2345]
  },
  "pestInfo": {
    "isInfested": true,
    "species": "bollworm",
    "severity": "中",
    "confidence": 0.93
  },
  "imageUrl": "https://example.com/pest.jpg"
}
```

**响应：**
```json
{
  "code": 0,
  "message": "上报成功",
  "data": { "id": "664a1b2c3d4e5f6a7b8c9d0e" }
}
```

### GET /api/stats/region/:areaId?range=1d|3d|7d

区域虫害统计。使用 MongoDB 聚合管道实现。

**参数：**
- `areaId`: 行政区划代码，或 `all` 表示全省
- `range`: 时间窗口，`1d` / `3d` / `7d`

**响应：**
```json
{
  "code": 0,
  "data": {
    "areaId": "430100",
    "timeRange": "7d",
    "total": 85,
    "infested": 52,
    "rate": 61.18,
    "avgTemperature": 26.3,
    "avgHumidity": 67,
    "speciesDistribution": [
      { "species": "bollworm", "name": "棉铃虫", "count": 15 }
    ],
    "severityDistribution": [
      { "level": "轻", "count": 20 },
      { "level": "中", "count": 18 },
      { "level": "重", "count": 10 },
      { "level": "特重", "count": 4 }
    ],
    "trend": [
      { "date": "2026-07-01", "total": 12, "infested": 7, "rate": 58.33, "avgTemp": 27.5 }
    ]
  }
}
```

---

## 🔌 虫害类型 ID 对照表

| 中文名 | API ID | 说明 |
|--------|--------|------|
| 棉铃虫 | `bollworm` | 幼虫蛀食棉蕾和棉铃 |
| 红蜘蛛 | `spider_mite` | 吸食叶片背面汁液 |
| 蚜虫 | `aphid` | 聚集于嫩叶和花蕾造成卷叶 |
| 盲蝽象 | `lygus` | 刺吸棉株汁液 |
| 白粉虱 | `whitefly` | 吸食叶片汁液、分泌蜜露 |

---

## 🔄 从旧版迁移数据

如果你有旧版（JSON 文件存储）的历史数据，可以用迁移脚本导入 MongoDB：

```bash
# 1. 把旧版的 reports.json 放到 backend/data/ 目录下
# 2. 运行迁移
npm run migrate
```

---

## ✅ 验收自查清单

完成以下步骤来验证各模块是否正常工作：

- [ ] `npm install` 无报错
- [ ] MongoDB 连接成功（启动日志显示 "MongoDB 已连接"）
- [ ] 种子数据导入成功（`npm run seed` 完成后显示 "数据写入完成"）
- [ ] 服务启动无报错
- [ ] `curl http://localhost:3000/api/areas` 返回 14 个城市
- [ ] `curl -X POST ... /api/reports/submit` 返回 `"上报成功"`
- [ ] `curl "http://localhost:3000/api/stats/region/all?range=7d"` 返回统计数据
- [ ] 在 `.env` 中配置了真实的和风天气 Key 后，上报接口自动补全天气数据
- [ ] 浏览器打开 http://localhost:3000 能看到前端页面

---

## 📁 项目结构

```
backend/
├── server.js                # Express 应用入口
├── package.json             # 依赖管理
├── .env.example             # 环境变量模板
├── config/
│   └── db.js                # MongoDB 连接
├── models/
│   ├── Area.js              # 区域数据模型
│   └── PestReport.js        # 虫害上报数据模型
├── routes/
│   ├── areas.js             # GET /api/areas
│   ├── reports.js           # POST /api/reports/submit
│   └── stats.js             # GET /api/stats/region/:areaId
├── utils/
│   └── weather.js           # 和风天气 API 封装
├── middleware/
│   └── errorHandler.js      # 全局错误处理
├── scripts/
│   └── migrateFromJson.js   # 从 JSON 迁移到 MongoDB
└── seed.js                  # 种子数据生成器
```

---

## 📝 注意事项

1. **本代码未在沙箱环境中实际运行过**，需要你在本地跑一遍确认所有功能正常
2. 和风天气 API 在沙箱中无法测试，请配置真实 Key 后验证天气自动补全功能
3. 小程序前端部分（wx.getLocation + wx.request 上报 + web-view 地图页）需要在微信开发者工具中单独开发，本仓库仅提供后端 API 支持
4. 生产环境部署建议使用 PM2 进程管理、Nginx 反向代理 + HTTPS、MongoDB Atlas 云数据库
