const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const rateLimit = require('../middleware/rateLimit');

test('sliding window rejects bursts, returns retry time, then accepts expired window', () => {
  let now = 10000;
  const clock = mock.method(Date, 'now', () => now);
  try {
    const limit = rateLimit({ max: 2, windowMs: 1000, message: '测试限流' });
    let accepted = 0;
    const res = { headers: {}, set(k,v) { this.headers[k]=v; }, status(n) { this.code=n; return this; }, json(b) { this.body=b; } };
    const hit = () => limit({ ip: '127.0.0.1' }, res, () => accepted++);
    hit(); hit(); hit();
    assert.equal(accepted, 2);
    assert.equal(res.code, 429);
    assert.equal(res.body.message, '测试限流');
    assert.equal(res.headers['Retry-After'], '1');
    now += 1001;
    hit();
    assert.equal(accepted, 3);
  } finally { clock.mock.restore(); }
});
