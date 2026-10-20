const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');

test('all inline frontend scripts parse', () => {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    new vm.Script(match[1]);
  }
});

test('image URL is assigned as a DOM property, never interpreted as HTML', () => {
  const elements = new Map();
  function element() {
    return { style: {}, children: [], replaceChildren() { this.children = []; },
      appendChild(child) { this.children.push(child); },
      set innerHTML(_) { throw new Error('unexpected HTML sink'); }
    };
  }
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement(tag) { return { ...element(), tag }; }
  };
  const source = html.slice(html.indexOf('function showPointModal('), html.indexOf('function escx('));
  const context = vm.createContext({ document, window: {}, cityMap: {} });
  vm.runInContext(source, context);
  const url = 'https://example.test/a" onerror="alert(1)';
  context.showPointModal({ areaId: 430100, imageUrl: url, confidence: 0.93 });
  const image = elements.get('pmImgPreview').children[0];
  assert.equal(image.tag, 'img');
  assert.equal(image.src, url);
  assert.equal(elements.get('pmConf').textContent, '93%');
});
