const { test, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const axios = require('axios');
const COS = require('cos-nodejs-sdk-v5');

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.API_KEY = 'test-only-key';
process.env.UPLOAD_MAX_FILE_SIZE_MB = '0.001';
process.env.CORS_ORIGIN = 'https://example.test';
process.env.MONGOMS_DOWNLOAD_DIR ||= require('path').join(__dirname, '../node_modules/.cache/mongodb-binaries');
mock.method(COS.prototype, 'putObject', function (params, callback) {
  callback(null, {});
});
const weatherMock = mock.method(axios, 'get', async (_url, options) => {
  if (options.params.current) return { data: { current: {
    temperature_2m: 26, relative_humidity_2m: 70, weather_code: 0, time: '2026-10-20T10:00'
  } } };
  return { data: { hourly: {
    time: Array.from({ length: 24 }, (_, i) => options.params.start_date + 'T' + String(i).padStart(2, '0') + ':00'),
    temperature_2m: Array(24).fill(26), relative_humidity_2m: Array(24).fill(70), weather_code: Array(24).fill(0)
  } } };
});
const { start } = require('../server');
const Area = require('../models/Area');
const PestReport = require('../models/PestReport');
const ExpertReport = require('../models/ExpertReport');
let mongo, server, base;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  server = await start();
  await Promise.all([Area.init(), PestReport.init(), ExpertReport.init()]);
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
  mock.restoreAll();
});
beforeEach(async () => {
  await Promise.all([Area.deleteMany({}), PestReport.deleteMany({}), ExpertReport.deleteMany({})]);
  await Area.create({ name: '长沙市', adcode: 430100, center: { type: 'Point', coordinates: [112.94, 28.23] } });
});

async function request(url, body, headers = {}) {
  const response = await fetch(base + url, body === undefined ? { headers } : {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-only-key', ...headers },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}
const validReport = () => ({
  location: { type: 'Point', coordinates: [112.94, 28.23] },
  pestInfo: { isInfested: true, species: 'bollworm', severity: '中', confidence: 0.93 }
});

test('health, areas, frontend and CORS run through HTTP', async () => {
  assert.equal((await request('/api/health')).body.code, 0);
  assert.deepEqual((await request('/api/areas')).body.data, [{ id: '430100', name: '长沙市', center: [112.94, 28.23] }]);
  const res = await fetch(base + '/', { headers: { Origin: 'https://example.test' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://example.test');
  assert.match(await res.text(), /window\.BACKEND_URL\|\|window\.location\.origin/);
  assert.equal((await request('/api/missing')).status, 404);
});

test('submit saves weather and returns confidence for map details', async () => {
  const result = await request('/api/reports/submit', validReport());
  assert.equal(result.status, 201);
  const saved = await PestReport.findById(result.body.data.id).lean();
  assert.equal(saved.areaId, 430100);
  assert.equal(saved.weather.temperature, 26);
  assert.equal((await request('/api/reports')).body.data[0].confidence, 0.93);
});

test('expert form fields survive MongoDB persistence', async () => {
  const result = await request('/api/reports/expert', { name: '棉铃虫', expert: '测试专家', contact: 'test@example.test' });
  assert.equal(result.status, 201);
  const saved = await ExpertReport.findById(result.body.data.id).lean();
  assert.equal(saved.pestName, '棉铃虫');
  assert.equal(saved.expertName, '测试专家');
  assert.equal(saved.contact, 'test@example.test');
});

test('miniapp converts percentage and preserves API response', async () => {
  const result = await request('/api/reports/miniapp', { results: [{ clz: '棉铃虫', prob: 95 }], location: { lng: 112.94, lat: 28.23 } });
  assert.equal(result.status, 200);
  const saved = await PestReport.findById(result.body.data.id).lean();
  assert.equal(saved.pestInfo.confidence, 0.95);
  assert.equal(saved.pestInfo.species, 'bollworm');
});

test('bad JSON, missing key, bad coordinates and malformed area IDs return 4xx', async () => {
  const invalidJson = await fetch(base + '/api/reports/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(invalidJson.status, 400);
  assert.equal((await request('/api/reports/submit', validReport(), { 'x-api-key': '' })).status, 401);
  assert.equal((await request('/api/reports/submit', { ...validReport(), location: { coordinates: '12' } })).status, 400);
  for (const url of ['/api/stats/region/430100oops', '/api/stats/advice/nope', '/api/stats/trend?areaId=abc', '/api/reports?areaId=430100oops', '/api/weather/area/nope']) {
    assert.equal((await request(url)).status, 400, url);
  }
});

test('region distributions and risk endpoints agree on confidence threshold', async () => {
  await PestReport.insertMany([0.9, 0.2, 0.3].map(confidence => ({
    ...validReport(), areaId: 430100, pestInfo: { ...validReport().pestInfo, confidence },
    weather: { temperature: 26, humidity: 70, condition: '晴' }
  })));
  const stats = (await request('/api/stats/region/all?range=7d')).body.data;
  assert.equal(stats.total, 3);
  assert.equal(stats.infested, 1);
  assert.equal(stats.speciesDistribution.reduce((n, s) => n + s.count, 0), 1);
  assert.equal(stats.severityDistribution.reduce((n, s) => n + s.count, 0), 1);
  assert.equal((await request('/api/stats/overview')).body.data.riskEventCount, 1);
  for (const url of ['/api/stats/focus-areas', '/api/stats/advice/all', '/api/stats/alerts', '/api/stats/trend', '/api/stats/suggestion']) {
    assert.equal((await request(url)).body.code, 0, url);
  }
});

test('empty statistics remain valid', async () => {
  const stats = (await request('/api/stats/region/all')).body.data;
  assert.equal(stats.total, 0);
  assert.equal(stats.rate, 0);
  assert.deepEqual(stats.speciesDistribution, []);
  assert.equal((await request('/api/stats/trend')).body.data.length, 7);
});

test('weather endpoint reuses cache', async () => {
  const before = weatherMock.mock.callCount();
  const first = await request('/api/weather/area/430100');
  const second = await request('/api/weather/area/430100');
  assert.equal(first.body.data.temperature, 26);
  assert.equal(second.body.data.cached, true);
  assert.equal(weatherMock.mock.callCount() - before, 1);
});

test('both upload field conventions, errors and size limits remain supported', async () => {
  for (const [url, field] of [['/api/upload/upload-image', 'image'], ['/upload/image', 'file']]) {
    const form = new FormData();
    form.append('description', 'field before file');
    form.append(field, new Blob(['test image'], { type: 'image/png' }), 'image.png');
    const res = await fetch(base + url, { method: 'POST', body: form });
    assert.equal(res.status, 200);
    assert.match((await res.json()).url, /^https:\/\//);
    const large = new FormData();
    large.append(field, new Blob(['x'.repeat(2048)]), 'large.png');
    assert.equal((await fetch(base + url, { method: 'POST', body: large })).status, 413);
    const wrong = new FormData();
    wrong.append('wrong-field', new Blob(['x']), 'a.png');
    assert.equal((await fetch(base + url, { method: 'POST', body: wrong })).status, 400);
  }
});

test('geography lookup works outside repository working directory', () => {
  const cwd = process.cwd();
  try {
    process.chdir(require('os').tmpdir());
    assert.equal(require('../utils/hunanGeo').checkHunanCity(112.94, 28.23).adcode, 430100);
  } finally { process.chdir(cwd); }
});

test('production cannot fall back to the publicly known development key', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.API_KEY;
  try {
    assert.equal((await request('/api/reports/submit', validReport(), {
      'x-api-key': 'cotton-pest-2026-miniapp-key'
    })).status, 503);
  } finally {
    process.env.NODE_ENV = 'test';
    process.env.API_KEY = 'test-only-key';
  }
});

test('weather failure still saves report and cools down repeated upstream calls', async () => {
  weatherMock.mock.mockImplementation(async () => { throw Object.assign(new Error('rate limited'), { response: { status: 429 } }); });
  const body = { ...validReport(), timestamp: '2026-01-01T03:00:00Z' };
  const calls = weatherMock.mock.callCount();
  const result = await request('/api/reports/submit', body);
  assert.equal(result.status, 201);
  const saved = await PestReport.findById(result.body.data.id).lean();
  assert.equal(saved.weather.temperature, null);
  assert.equal(saved.weather.condition, '未知');
  assert.equal((await request('/api/reports/submit', body)).status, 201);
  assert.equal(weatherMock.mock.callCount() - calls, 1);
});
