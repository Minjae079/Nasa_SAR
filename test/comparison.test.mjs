// 수정된 부분: regression tests for stale results, late responses and image URL extraction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function frontend(fetch, maplibregl) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: false, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
      replaceChildren() {}, append() {}, setAttribute() {}, removeAttribute(name) { delete this[name]; },
    });
    return nodes.get(id);
  };
  const context = vm.createContext({
    fetch, console, clearTimeout, encodeURIComponent, URL, maplibregl,
    window: { matchMedia: () => ({ matches: true }), addEventListener() {} },
    document: { getElementById: node, readyState: 'loading', addEventListener() {},
      createElement: () => ({}) },
  });
  // Expose the real controller without booting WebGL or CDN assets.
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace('  function start() {', `
    globalThis.controller = {
      openComparison, setImage, initGlobe, syncZoomMode, goHome, openMap, setBasemap,
      showComparisonFromMap,
      state: () => ({ lastComparedPoint, comparisonPairs, mode, map }),
      leave: () => { comparisonRequestId++; mode = 'map'; },
    };
    function start() {`), context);
  return { controller: context.controller, node };
}

const pair = {
  before: { date: '2026-10-10', browse: 'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/before.png' },
  after: { date: '2026-10-22', browse: 'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/after.png' },
};
const result = () => ({ ok: true, json: async () => ({ pairs: [pair] }) });

test('new searches clear previous results, including when the search fails', async () => {
  let fail = false;
  const { controller } = frontend(async () => {
    if (fail) throw new Error('offline');
    return result();
  });
  await controller.openComparison(41, -87);
  assert.equal(controller.state().comparisonPairs.length, 1);
  fail = true;
  await controller.openComparison(30, -90);
  assert.equal(controller.state().lastComparedPoint, null);
  assert.equal(controller.state().comparisonPairs.length, 0);
});

test('late responses cannot replace a newer location or repopulate results after leaving', async () => {
  const pending = [];
  const { controller } = frontend(() => new Promise(resolve => pending.push(resolve)));
  const first = controller.openComparison(41, -87);
  const second = controller.openComparison(30, -90);
  pending[1](result());
  await second;
  pending[0](result());
  await first;
  assert.equal(controller.state().lastComparedPoint.lat, 30);
  const third = controller.openComparison(20, -80);
  controller.leave();
  pending[2](result());
  await third;
  assert.equal(controller.state().lastComparedPoint, null);
});

test('comparison images unwrap encoded preview URLs and remove appended image paths', () => {
  const { controller, node } = frontend(async () => result());
  const url = 'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/sample.png';
  for (const input of [url, encodeURIComponent(url),
    '/api/preview?url=' + encodeURIComponent(url),
    '/api/preview?url=' + encodeURIComponent('/api/preview?url=' + encodeURIComponent(url)),
    url + '/sample.png?download=1#preview']) {
    controller.setImage('image', 'error', input);
    assert.equal(node('image').src, url);
  }
  node('image').onerror();
  assert.equal(node('image').hidden, true);
  assert.equal(node('error').hidden, false);
});

test('invalid image links clear the old source and show the image error', () => {
  const { controller, node } = frontend(async () => result());
  controller.setImage('image', 'error', 'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/sample.png');
  controller.setImage('image', 'error', '/api/preview?url=' + encodeURIComponent('https://evil.example/image.png'));
  assert.equal(node('image').src, undefined);
  assert.equal(node('image').hidden, true);
  assert.equal(node('error').hidden, false);
});

// 수정된 부분: verify automatic zoom navigation uses one persistent map instance.
test('zoom alone enters and exits detail view without recreating the map', () => {
  let instances = 0;
  class Map {
    constructor(options) {
      instances++;
      this.zoom = options.zoom;
      this.center = { lng: -87, lat: 41 };
      this.events = {};
      this.properties = {};
      assert.equal(options.style.projection.type, 'globe');
    }
    on(name, handler) { this.events[name] = handler; }
    getCanvas() { return { setAttribute() {} }; }
    getZoom() { return this.zoom; }
    getCenter() { return this.center; }
    getLayer(id) { return ['streets', 'satellite'].includes(id); }
    setLayoutProperty(id, property, value) { this.properties[id + property] = value; }
    flyTo(options) {
      this.zoom = options.zoom;
      this.center = { lng: options.center[0], lat: options.center[1] };
      this.events.zoom();
      this.events.moveend();
    }
  }
  const { controller, node } = frontend(async () => result(), { Map });
  controller.initGlobe();
  const map = controller.state().map;
  map.zoom = 7;
  map.events.zoom();
  assert.equal(controller.state().mode, 'map');
  assert.equal(node('mapScene').hidden, false);
  map.zoom = 5;
  map.events.zoom();
  assert.equal(controller.state().mode, 'globe');
  assert.equal(node('mapScene').hidden, true);
  controller.openMap(41, -87);
  assert.equal(controller.state().mode, 'map');
  controller.setBasemap('streets');
  assert.equal(map.properties.streetsvisibility, 'visible');
  controller.goHome();
  assert.equal(controller.state().mode, 'globe');
  assert.equal(node('mapScene').hidden, true);
  assert.equal(controller.state().map, map);
  assert.equal(instances, 1);
});
