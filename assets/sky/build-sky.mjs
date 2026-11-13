// Rebuild with: node assets/sky/build-sky.mjs
// Catalog and constellation geometry: https://github.com/ofrohn/d3-celestial
import { readFileSync, writeFileSync } from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const project = ([ra, dec]) => [(180 - ra) / 360 * 2400, (90 - dec) / 180 * 1200];
const fixed = n => n.toFixed(2);
const lines = [];
for (const feature of read('constellations.lines.json').features) {
  for (const chain of feature.geometry.coordinates) {
    for (let i = 1; i < chain.length; i++) {
      const a = project(chain[i - 1]);
      const b = project(chain[i]);
      // Do not draw across the right-ascension seam.
      if (Math.abs(a[0] - b[0]) > 1200) continue;
      lines.push(`<path d="M${a.map(fixed).join(',')}L${b.map(fixed).join(',')}"/>`);
    }
  }
}
const stars = read('stars.6.json').features.map(feature => {
  const [x, y] = project(feature.geometry.coordinates);
  const mag = feature.properties.mag;
  const radius = Math.max(0.45, 1.85 - mag * 0.22);
  const opacity = Math.max(0.25, Math.min(1, 1.2 - mag * 0.14));
  const color = Number(feature.properties.bv) > 0.9 ? '#ffe0bc' : '#d9edff';
  return `<circle cx="${fixed(x)}" cy="${fixed(y)}" r="${fixed(radius)}" fill="${color}" opacity="${fixed(opacity)}"/>`;
});
writeFileSync(new URL('constellation-sky.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 1200">
<title>Stars and constellations in equatorial coordinates</title>
<desc>Fixed equirectangular sky chart from d3-celestial catalog data. Decorative, not a live observer sky. Copyright Olaf Frohn; see LICENSE.</desc>
<g fill="none" stroke="#7ba9d5" stroke-width="0.65" stroke-opacity="0.25">${lines.join('')}</g>
${stars.join('')}
</svg>`);
