const fs = require('fs');
const path = require('path');

let hunanGeo = null;

function loadGeo() {
  if (hunanGeo) return hunanGeo;
  const candidates = [
    path.join(__dirname, '..', '..', 'frontend', 'assets', 'hunan.json'),
    path.join(__dirname, '..', '..', 'frontend', 'hunan.json'),
    path.join(__dirname, 'assets', 'hunan.json'),
    path.join(__dirname, '..', 'assets', 'hunan.json')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      hunanGeo = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return hunanGeo;
    }
  }
  throw new Error('找不到 hunan.json 边界数据');
}

function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const hit = ((yi > pt[1]) !== (yj > pt[1])) &&
      (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

function pointInFeature(feature, pt) {
  const g = feature.geometry;
  if (!g) return false;
  const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
  for (const poly of polys) {
    if (!poly.length) continue;
    if (pointInRing(pt, poly[0])) {
      let inHole = false;
      for (let h = 1; h < poly.length; h++) {
        if (pointInRing(pt, poly[h])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

function checkHunanCity(lng, lat) {
  const geo = loadGeo();
  const pt = [lng, lat];
  for (const feature of geo.features) {
    if (pointInFeature(feature, pt)) {
      return {
        name: feature.properties.name,
        adcode: feature.properties.adcode
      };
    }
  }
  return null;
}

module.exports = { checkHunanCity };
