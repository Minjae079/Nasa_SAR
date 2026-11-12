/* SARSCOPE: basemaps are geographic context, not SAR measurements. */
(() => {
  "use strict";
  const IIT = Object.freeze({ lat: 41.83531, lng: -87.627, name: "Illinois Tech" });
  const START = { center: [-86, 34], zoom: 0.5, bearing: 0, pitch: 0 };
  const DETAIL_ZOOM = 6;
  const PHOTO_ZOOM = 2.5;
  // 수정된 부분: duration in milliseconds for View local map.
  const LOCAL_MAP_FLIGHT_MS = 2400;
  const $ = id => document.getElementById(id);
  const globeScene = $("globeScene");
  const mapScene = $("mapScene");
  const compareScene = $("compareScene");
  const fallback = $("globeFallback");
  let map;
  let marker;
  let mode = "globe";
  let currentTarget = { ...IIT };
  let comparisonRequestId = 0;
  let comparisonPairs = [];
  let lastComparedPoint = null;
  let activeBasemap = "satellite";
  let rasterConfig = null;
  let selectedLocation = false;
  let cameraDestination = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileLayout = window.matchMedia("(max-width: 800px)");

  // 수정된 부분: a single MapLibre canvas renders the globe and local map.
  function initGlobe() {
    if (typeof maplibregl === "undefined") { fallback.hidden = false; return; }
    try {
      map = new maplibregl.Map({
        container: "globeViz", ...START, minZoom: 0, maxZoom: 19,
        attributionControl: { compact: true },
        style: {
          version: 8, projection: { type: "globe" },
          sources: {
            satellite: { type: "raster", tileSize: 256, maxzoom: 19,
              tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
              attribution: "Imagery &copy; Esri and its imagery contributors" },
            streets: { type: "raster", tileSize: 256, maxzoom: 19,
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }
          },
          layers: [
            { id: "satellite", type: "raster", source: "satellite" },
            { id: "streets", type: "raster", source: "streets", layout: { visibility: "none" } }
          ],
          sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] }
        }
      });
      map.getCanvas().setAttribute("aria-label", "Earth map: drag, scroll or pinch to zoom continuously from globe to streets");
      // No second renderer, tile cache reset, delayed swap or click is needed.
      map.on("zoom", syncZoomMode);
      map.on("movestart", event => {
        if (event.originalEvent) {
          cameraDestination = null;
          selectedLocation = false;
        }
      });
      map.on("dragstart", () => { selectedLocation = false; });
      map.on("moveend", () => {
        cameraDestination = null;
        syncZoomMode();
        if (mode === "map") updateLocationFromCenter();
      });
      map.on("click", event => {
        const { lat, lng } = event.lngLat;
        if (mode === "map") {
          currentTarget = { lat, lng, name: isNearIIT(lat, lng) ? IIT.name : "Selected location" };
          selectedLocation = true;
          updateLocationPanel();
        } else flyTo(lat, lng);
      });
      map.on("load", () => {
        marker = new maplibregl.Marker({ color: "#d5fa79" })
          .setLngLat([currentTarget.lng, currentTarget.lat]).addTo(map);
        applyBasemap();
        installRasterLayers();
      });
      map.on("error", event => {
        console.error("Map resource unavailable", event.error);
        $("mapLoadStatus").hidden = false;
        $("mapLoadStatus").textContent = "Some map tiles could not load. Check your connection and try zooming again.";
      });
      map.on("idle", () => { $("mapLoadStatus").hidden = true; });
      window.addEventListener("resize", resizeGlobe);
    } catch (error) {
      console.error("Unable to create Earth map", error);
      fallback.hidden = false;
    }
  }
  function resizeGlobe() { if (map) map.resize(); }
  function coordLabel(lat, lng) {
    return Math.abs(lat).toFixed(5) + "° " + (lat >= 0 ? "N" : "S") + " · " + Math.abs(lng).toFixed(5) + "° " + (lng >= 0 ? "E" : "W");
  }
  function isNearIIT(lat, lng) { return Math.abs(lat - IIT.lat) < 0.1 && Math.abs(lng - IIT.lng) < 0.14; }
  function setLocationPanelExpanded(expanded) {
    $("locationCard").classList.toggle("is-collapsed", !expanded);
    $("toggleLocationPanel").setAttribute("aria-expanded", String(expanded));
    $("panelToggleText").textContent = expanded ? "Hide location details" : "Show location details";
  }
  function updateLocationPanel() {
    const { lat, lng } = currentTarget;
    $("selectedPlace").textContent = currentTarget.name;
    $("selectedCoords").textContent = coordLabel(lat, lng);
    const near = isNearIIT(lat, lng);
    $("iitDataPanel").hidden = !near;
    $("outsideDataPanel").hidden = near;
    if (marker) marker.setLngLat([lng, lat]);
    refreshRasterLayers(mode === "map" && near);
  }
  function updateLocationFromCenter() {
    if (selectedLocation) return;
    const { lat, lng } = map.getCenter();
    currentTarget = { lat, lng, name: isNearIIT(lat, lng) ? IIT.name : "Map center" };
    updateLocationPanel();
  }
  // 수정된 부분: zoom changes only UI overlays; the underlying map stays mounted.
  function syncZoomMode() {
    if (!map || (cameraDestination !== null && cameraDestination < DETAIL_ZOOM)) return;
    if (map.getZoom() >= DETAIL_ZOOM && mode !== "map") {
      comparisonRequestId++;
      mode = "map";
      compareScene.hidden = true;
      globeScene.classList.remove("is-comparing");
      globeScene.classList.add("is-detail");
      mapScene.hidden = false;
      if (mobileLayout.matches) setLocationPanelExpanded(true);
      updateLocationFromCenter();
      updateLocationPanel();
    } else if (map.getZoom() < DETAIL_ZOOM - 0.5 && mode === "map") {
      mode = "globe";
      mapScene.hidden = true;
      globeScene.classList.remove("is-detail");
      refreshRasterLayers(false);
    }
  }
  function globeZoom(direction) {
    cameraDestination = null;
    if (map) map.zoomTo(map.getZoom() + (direction === "in" ? 1 : -1), { duration: reducedMotion.matches ? 0 : 250 });
  }
  function flyTo(lat, lng) {
    cameraDestination = PHOTO_ZOOM;
    selectedLocation = true;
    // 수정된 부분: search starts immediately, independently of camera animation.
    openComparison(lat, lng);
    if (map) map.flyTo({ center: [lng, lat], zoom: PHOTO_ZOOM, duration: reducedMotion.matches ? 0 : 1000 });
  }
  function goHome() {
    cameraDestination = START.zoom;
    comparisonRequestId++;
    mode = "globe";
    selectedLocation = false;
    globeScene.hidden = false;
    globeScene.classList.remove("is-comparing", "is-detail");
    compareScene.hidden = true;
    mapScene.hidden = true;
    refreshRasterLayers(false);
    if (map) map.flyTo({ ...START, duration: reducedMotion.matches ? 0 : 1000 });
  }
  function showComparisonFromMap() {
    cameraDestination = PHOTO_ZOOM;
    const { lat, lng } = currentTarget;
    globeScene.classList.remove("is-detail");
    mapScene.hidden = true;
    const reuse = lastComparedPoint && Math.abs(lastComparedPoint.lat - lat) < 0.000001 &&
      Math.abs(lastComparedPoint.lng - lng) < 0.000001 && comparisonPairs.length;
    if (reuse) {
      mode = "compare";
      globeScene.classList.add("is-comparing");
      compareScene.hidden = false;
    } else openComparison(lat, lng);
    refreshRasterLayers(false);
    if (map) map.flyTo({ center: [lng, lat], zoom: PHOTO_ZOOM, duration: reducedMotion.matches ? 0 : 900 });
  }
  function openMap(lat, lng) {
    cameraDestination = null;
    if (!map) { fallback.hidden = false; return; }
    comparisonRequestId++;
    currentTarget = { lat, lng, name: isNearIIT(lat, lng) ? IIT.name : "Selected location" };
    selectedLocation = true;
    compareScene.hidden = true;
    globeScene.classList.remove("is-comparing");
    mode = "globe";
    // 수정된 부분: one uninterrupted camera flight, without screen-switch timers.
    map.flyTo({ center: [lng, lat], zoom: isNearIIT(lat, lng) ? 15 : 12, duration: reducedMotion.matches ? 0 : LOCAL_MAP_FLIGHT_MS });
    syncZoomMode();
    updateLocationPanel();
  }
  function updateComparisonStatus(message, kind = "info") {
    const node = $("compareStatus");
    node.textContent = message;
    node.dataset.kind = kind;
  }
  function formatDate(date) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Unknown date";
    return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  // 수정된 부분: keep one URL parser for original and preview-wrapped image links.
  // 수정된 부분: unwrap preview URLs before assigning the original NASA image URL.
  function extractImageUrl(input) {
    if (typeof input !== "string" || input.length > 8000) throw new Error("Invalid image URL");
    let raw = input.trim();
    for (let depth = 0; depth < 5; depth++) {
      if (/^https?%3a/i.test(raw)) raw = decodeURIComponent(raw);
      const parsed = new URL(raw, "https://sarscope.invalid");
      if (parsed.pathname === "/api/preview" && parsed.searchParams.has("url")) {
        raw = parsed.searchParams.get("url");
        continue;
      }
      if (parsed.protocol !== "https:" || parsed.hostname !== "nisar.asf.earthdatacloud.nasa.gov" ||
          parsed.port || parsed.username || parsed.password || !parsed.pathname.startsWith("/BROWSE/")) {
        throw new Error("Invalid NASA image URL");
      }
      const match = parsed.pathname.match(/\.png(?=\/|$)/i);
      if (!match) throw new Error("Image extension not found");
      // Remove appended paths, query strings and fragments left by wrapped links.
      parsed.pathname = parsed.pathname.slice(0, match.index + match[0].length);
      parsed.search = "";
      parsed.hash = "";
      return parsed.href;
    }
    throw new Error("Too many nested preview URLs");
  }

  function setImage(elementId, errorId, url) {
    const image = $(elementId);
    const error = $(errorId);

    error.hidden = true;
    image.hidden = false;

    image.onload = () => {
      image.hidden = false;
      error.hidden = true;
    };

    image.onerror = () => {
      image.hidden = true;
      error.hidden = false;
      console.error("Image loading failed:", image.src);
    };

    try {
      image.src = extractImageUrl(url);
    } catch (error) {
      image.removeAttribute("src");
      image.onerror();
    }
  }

  function renderPair(pair) {
    $("sarCompareGrid").hidden = false;
    $("beforeDate").textContent = formatDate(pair.before.date);
    $("afterDate").textContent = formatDate(pair.after.date);
    $(
      "beforeMeta"
    ).textContent = `Track ${pair.track} · Frame ${pair.frame} · ${pair.direction}`;
    $(
      "afterMeta"
    ).textContent = `${pair.polarization} · ${pair.dayGap} days apart`;
    for (const item of ["before", "after"]) {
      const link = $(item + "Source");
      try { link.href = extractImageUrl(pair[item].browse); }
      catch { link.removeAttribute("href"); }
      link.title = pair[item].id;
      setImage(item + "Image", item + "Error", pair[item].browse);
    }
  }

  // 수정된 부분: clear stale results before searching and save the location only on success.
  async function openComparison(lat, lng) {
    lastComparedPoint = null;
    comparisonPairs = [];
    const requestId = ++comparisonRequestId;
    mode = "compare";
    currentTarget = {
      lat,
      lng,
      name: isNearIIT(lat, lng)
        ? "Illinois Tech · Chicago"
        : "Selected Earth region",
    };
    // 수정된 부분: move the selection pin immediately, even before images finish loading.
    if (marker) marker.setLngLat([lng, lat]);
    globeScene.hidden = false;
    globeScene.classList.remove("is-detail");
    globeScene.classList.add("is-comparing");
    refreshRasterLayers(false);
    mapScene.hidden = true;
    compareScene.hidden = false;
    $("compareRegion").textContent = currentTarget.name;
    $("compareCoordinates").textContent = coordLabel(lat, lng);
    $("sarCompareGrid").hidden = true;
    $("pairChooser").hidden = true;
    updateComparisonStatus(
      "Searching NASA ASF catalog for matched NISAR GCOV acquisitions…"
    );
    try {
      const response = await fetch(
        `/api/coverage?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(
          lng
        )}`,
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok)
        throw new Error(
          `Backend returned HTTP ${response.status}. Use npm run dev or deploy the Vercel API functions.`
        );
      const result = await response.json();
      if (requestId !== comparisonRequestId || mode !== "compare") return;
      comparisonPairs = result.pairs || [];
      if (!comparisonPairs.length) {
        const detail = result.warning
          ? " Search service was also unavailable."
          : "";
        updateComparisonStatus(
          `No two matching NISAR GCOV dates found at this location.${detail} Select another location or try Illinois Tech.`,
          "empty"
        );
        return;
      }
      // 수정된 부분: mark this location reusable only after matching observations are available.
      lastComparedPoint = { lat, lng };
      const chooser = $("pairSelect");
      chooser.replaceChildren();
      comparisonPairs.forEach((p, i) => {
        const option = document.createElement("option");
        option.value = String(i);
        option.textContent = `Track ${p.track} · Frame ${p.frame} · ${p.before.date} → ${p.after.date} (${p.matchedObservations} dates)`;
        chooser.append(option);
      });
      $("pairChooser").hidden = false;
      $(
        "pairCount"
      ).textContent = `${result.matchedGCOVObservations} GCOV scenes covering location`;
      updateComparisonStatus(
        `Showing the latest available matched observations (${
          result.source === "asf-live"
            ? "ASF live catalog"
            : "uploaded IIT catalog"
        }). ${result.warning || ""}`,
        "ready"
      );
      renderPair(comparisonPairs[0]);
    } catch (error) {
      if (requestId !== comparisonRequestId || mode !== "compare") return;
      updateComparisonStatus(`Unable to search: ${error.message}`, "error");
    }
  }
  // 수정된 부분: switch layers on the same style; preserve projection and tile cache.
  function setBasemap(name) {
    if (!["streets", "satellite"].includes(name)) return;
    activeBasemap = name;
    applyBasemap();
  }
  function applyBasemap() {
    if (!map || !map.getLayer("streets")) return;
    map.setLayoutProperty("streets", "visibility", activeBasemap === "streets" ? "visible" : "none");
    $("streetLayer").classList.toggle("is-selected", activeBasemap === "streets");
    $("satelliteLayer").classList.toggle("is-selected", activeBasemap === "satellite");
  }
  // 수정된 부분: optional prepared SAR images use MapLibre image sources.
  async function tryLoadSarLayers() {
    try {
      const response = await fetch("./data/sar_layers.json", { cache: "no-store" });
      if (!response.ok) return;
      const config = await response.json();
      const bounds = config.bounds;
      if (!config.before_image || !config.after_image || !Array.isArray(bounds) || bounds.length !== 2 ||
          !bounds.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return;
      const [[south, west], [north, east]] = bounds;
      if (south >= north || west >= east || south < -90 || north > 90 || west < -180 || east > 180) return;
      rasterConfig = config;
      installRasterLayers();
    } catch (error) { console.debug("Optional SAR layers unavailable", error); }
  }
  function installRasterLayers() {
    if (!rasterConfig || !map || !map.isStyleLoaded() || map.getSource("sar-before")) return;
    const [[south, west], [north, east]] = rasterConfig.bounds;
    const coordinates = [[west, north], [east, north], [east, south], [west, south]];
    for (const time of ["before", "after"]) {
      map.addSource("sar-" + time, { type: "image", url: rasterConfig[time + "_image"], coordinates });
      map.addLayer({ id: "sar-" + time, type: "raster", source: "sar-" + time,
        layout: { visibility: "none" }, paint: { "raster-opacity": time === "before" ? 0.78 : 0.4 } });
    }
    $("comparisonControls").hidden = false;
    $("rasterStatus").textContent = (rasterConfig.before_date || "Before") + " / " + (rasterConfig.after_date || "After");
    const badge = document.querySelector(".data-status");
    badge.classList.add("is-ready");
    badge.querySelector("span:last-child").textContent = "Prepared raster overlay loaded - review quality";
    badge.querySelector(".data-status-icon").textContent = "OK";
    $("compareSlider").addEventListener("input", event => {
      const opacity = Number(event.target.value) / 100;
      map.setPaintProperty("sar-after", "raster-opacity", opacity * 0.8);
      $("comparePct").textContent = Math.round(opacity * 100) + "% after";
    });
    refreshRasterLayers(mode === "map" && isNearIIT(currentTarget.lat, currentTarget.lng));
  }
  function refreshRasterLayers(show) {
    if (!map) return;
    for (const id of ["sar-before", "sar-after"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", show ? "visible" : "none");
    }
  }
  function toggleModal(visible) {
    $("aboutModal").hidden = !visible;
  }
  function bindControls() {
    $("brandHome").addEventListener("click", goHome);
    $("compareBack").addEventListener("click", goHome);
    $("compareMap").addEventListener("click", () =>
      openMap(currentTarget.lat, currentTarget.lng)
    );
    $("backToComparison").addEventListener("click", showComparisonFromMap);
    $("pairSelect").addEventListener("change", (e) => {
      const pair = comparisonPairs[Number(e.target.value)];
      if (pair) renderPair(pair);
    });
    $("navExplore").addEventListener("click", goHome);
    $("navHow").addEventListener("click", () => toggleModal(true));
    $("learnMore").addEventListener("click", () => toggleModal(true));
    $("mobileAbout").addEventListener("click", () => toggleModal(true));
    $("toggleLocationPanel").addEventListener("click", () => {
      const expanded =
        $("toggleLocationPanel").getAttribute("aria-expanded") === "true";
      setLocationPanelExpanded(!expanded);
    });
    $("closeAbout").addEventListener("click", () => toggleModal(false));
    $("startExplore").addEventListener("click", () => toggleModal(false));
    $("aboutModal").addEventListener("click", (event) => {
      if (event.target === $("aboutModal")) toggleModal(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") toggleModal(false);
    });
    $("exploreIIT").addEventListener("click", () =>
      flyTo(IIT.lat, IIT.lng, IIT.name)
    );
    $("railIIT").addEventListener("click", () =>
      flyTo(IIT.lat, IIT.lng, IIT.name)
    );
    $("jumpToIITFromMap").addEventListener("click", () =>
      openMap(IIT.lat, IIT.lng)
    );
    $("backToGlobe").addEventListener("click", goHome);
    $("resetGlobe").addEventListener("click", goHome);
    $("zoomInGlobe").addEventListener("click", () => globeZoom("in"));
    $("zoomOutGlobe").addEventListener("click", () => globeZoom("out"));
    $("streetLayer").addEventListener("click", () => setBasemap("streets"));
    $("satelliteLayer").addEventListener("click", () =>
      setBasemap("satellite")
    );
  }
  // 수정된 부분: the Close label now lives in HTML instead of being overwritten at startup.
  function start() {
    // 기존 비교 화면을 지구본 내부로 이동
    globeScene.appendChild(compareScene);

    bindControls();
    initGlobe();
    // No API keys, SAR claims or mock detection results are embedded in the demo.
    // Prepared overlays attach to the shared map after its style loads.
    tryLoadSarLayers();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
