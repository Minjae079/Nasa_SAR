/* SARSCOPE learning prototype. No actual SAR measurements are implied by the basemap. */
(() => {
  "use strict";

  const IIT = Object.freeze({
    lat: 41.83531,
    lng: -87.627,
    name: "Illinois Tech",
  });
  const START = Object.freeze({ lat: 34, lng: -86, altitude: 2.1 });
  const $ = (id) => document.getElementById(id);
  const globeScene = $("globeScene");
  const mapScene = $("mapScene");
  const compareScene = $("compareScene");
  const fallback = $("globeFallback");
  let globe;
  let map;
  let marker;
  let focusRing;
  let streetsLayer;
  let satelliteLayer;
  let beforeOverlay;
  let afterOverlay;
  let hasSARLayers = false;
  let activeBasemap = "streets";
  let mode = "globe";
  let currentTarget = { ...IIT };
  let flyTimer = 0;
  let stopped = false;
  let comparisonRequestId = 0;
  let comparisonPairs = [];
  let lastComparedPoint = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileLayout = window.matchMedia("(max-width: 800px)");

  /* SARSCOPE Camera Animation Settings */

  const CAMERA = {
    photo: 2.0, // SAR 사진 화면: 약간 확대
    map: 0.3, // 상세 지도 진입 전: 크게 확대
    photoTime: 1200, // 홈 → SAR (1.2초)
    mapTime: 1000, // SAR → 지도 (1초)
    returnTime: 1100, // 되돌아올 때 (1.1초)
  };

  let viewTimer = 0;
  let viewToken = 0;

  // 이전 화면 전환 애니메이션 취소
  function resetViewMotion() {
    clearTimeout(flyTimer);
    clearTimeout(viewTimer);

    viewToken++;

    mapScene.classList.remove("is-view-entering", "is-view-leaving");

    globeScene.classList.remove("is-map-zooming", "is-heading-home");

    return viewToken;
  }

  function setLocationPanelExpanded(expanded) {
    $("locationCard").classList.toggle("is-collapsed", !expanded);
    $("toggleLocationPanel").setAttribute("aria-expanded", String(expanded));
    $("panelToggleText").textContent = expanded
      ? "Hide location details"
      : "Show location details";
  }

  function coordLabel(lat, lng) {
    return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(
      lng
    ).toFixed(5)}° ${lng >= 0 ? "E" : "W"}`;
  }
  function isNearIIT(lat, lng) {
    return Math.abs(lat - IIT.lat) < 0.1 && Math.abs(lng - IIT.lng) < 0.14;
  }
  function stopRotation() {
    if (globe) globe.controls().autoRotate = false;
    stopped = true;
  }
  function initGlobe() {
    if (typeof Globe !== "function") {
      fallback.hidden = false;
      return;
    }
    try {
      globe = Globe({ animateIn: false })($("globeViz"))
        .globeImageUrl(
          "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg"
        )
        .bumpImageUrl(
          "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png"
        )
        .backgroundColor("rgba(0,0,0,0)")
        .showAtmosphere(true)
        .atmosphereColor("#72d1ca")
        .atmosphereAltitude(0.15)
        .pointsData([{ ...IIT, name: "Illinois Tech · Chicago" }])
        .pointLat("lat")
        .pointLng("lng")
        .pointLabel("name")
        .pointRadius(0.42)
        .pointAltitude(0.018)
        .pointColor(() => "#d5fa79")
        .pointsTransitionDuration(0)
        .onPointClick(() => flyTo(IIT.lat, IIT.lng, "Illinois Tech"))
        .onGlobeClick(({ lat, lng }) => flyTo(lat, lng));

      globe.controls().autoRotate = !reducedMotion.matches;
      globe.controls().autoRotateSpeed = 0.28;
      globe.controls().minDistance = 115;
      globe.controls().maxDistance = 800;
      globe.pointOfView(START, 0);
      globe
        .renderer()
        .domElement.setAttribute(
          "aria-label",
          "3D Earth — drag to rotate, scroll to zoom, click a location"
        );
      globe
        .renderer()
        .domElement.addEventListener("pointerdown", stopRotation, {
          passive: true,
        });
      resizeGlobe();
      window.addEventListener("resize", resizeGlobe);
      window.addEventListener("orientationchange", () =>
        window.setTimeout(resizeGlobe, 120)
      );
      if (window.ResizeObserver) {
        const observer = new ResizeObserver(() => resizeGlobe());
        observer.observe($("globeViz"));
      }
    } catch (error) {
      console.error("Unable to create WebGL globe", error);
      fallback.hidden = false;
    }
  }
  function resizeGlobe() {
    if (!globe) return;
    const rect = $("globeViz").getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    globe.width(Math.round(rect.width)).height(Math.round(rect.height));
  }
  function globeZoom(direction) {
    if (!globe) return;
    clearTimeout(flyTimer);
    stopRotation();
    const p = globe.pointOfView();
    const nextAlt = Math.max(
      0.17,
      Math.min(3.6, p.altitude * (direction === "in" ? 0.66 : 1.52))
    );
    globe.pointOfView({ altitude: nextAlt }, 500);
  }

  function flyTo(lat, lng, name) {
    const token = resetViewMotion();

    if (!globe) {
      openComparison(lat, lng);
      return;
    }

    stopRotation();

    currentTarget = {
      lat,
      lng,
      name:
        name || (isNearIIT(lat, lng) ? "Illinois Tech" : "Selected location"),
    };

    const duration = reducedMotion.matches ? 0 : CAMERA.photoTime;

    // 선택한 위치로 회전 + 약한 줌인
    globe.pointOfView(
      {
        lat,
        lng,
        altitude: CAMERA.photo,
      },
      duration
    );

    // 카메라 이동이 끝난 후 SAR 말풍선 표시
    flyTimer = window.setTimeout(() => {
      if (token !== viewToken) return;

      openComparison(lat, lng);
    }, duration + 50);
  }

  function goHome() {
    const token = resetViewMotion();

    const wasInMap = !mapScene.hidden;

    mode = "return-home";
    comparisonRequestId++;

    globeScene.hidden = false;
    resizeGlobe();

    if (wasInMap) {
      // 지도 화면에서 홈으로 나올 때
      compareScene.hidden = true;
      mapScene.classList.add("is-view-leaving");

      if (globe) {
        globe.pointOfView(
          {
            lat: currentTarget.lat,
            lng: currentTarget.lng,
            altitude: CAMERA.map,
          },
          0
        );
      }
    } else {
      // SAR 사진 창을 서서히 숨김
      globeScene.classList.add("is-heading-home");
    }

    const duration = reducedMotion.matches ? 0 : CAMERA.returnTime;

    // 기본 지구본 크기로 복귀
    if (globe) {
      requestAnimationFrame(() => {
        if (token !== viewToken) return;
        globe.pointOfView(START, duration);
      });
    }

    viewTimer = window.setTimeout(() => {
      if (token !== viewToken) return;

      mapScene.hidden = true;
      compareScene.hidden = true;

      mapScene.classList.remove("is-view-leaving");

      globeScene.classList.remove(
        "is-comparing",
        "is-heading-home",
        "is-map-zooming"
      );

      if (map) map.closePopup();

      mode = "globe";
      $("navExplore").classList.add("is-active");
    }, duration + 50);
  }

  function closeComparison() {
    clearTimeout(flyTimer);

    // 이전 API 요청 무효화
    comparisonRequestId++;

    // 비교 패널 숨기기
    compareScene.hidden = true;

    // 일반 지구본 화면으로 돌아가기
    globeScene.classList.remove("is-comparing");
    globeScene.hidden = false;

    mode = "globe";
    resizeGlobe();
  }
  function initMap() {
    if (map || typeof L === "undefined") return Boolean(map);
    map = L.map("detailMap", {
      zoomControl: true,
      scrollWheelZoom: true,
      preferCanvas: true,
    });
    streetsLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    );
    satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Imagery &copy; Esri and its imagery contributors",
        maxZoom: 19,
      }
    );
    streetsLayer.addTo(map);
    map.setView([IIT.lat, IIT.lng], 13);
    marker = L.circleMarker([IIT.lat, IIT.lng], {
      radius: 7,
      color: "#d5fa79",
      weight: 3,
      fillColor: "#14232a",
      fillOpacity: 0.9,
    }).addTo(map);
    focusRing = L.circle([IIT.lat, IIT.lng], {
      radius: 600,
      color: "#c9fa86",
      weight: 1.7,
      dashArray: "6 6",
      fillColor: "#9ac7a4",
      fillOpacity: 0.07,
    }).addTo(map);
    return true;
  }

  function showComparisonFromMap() {
    const token = resetViewMotion();

    const { lat, lng } = currentTarget;

    // 기존 SAR 이미지 재사용 가능 여부
    const sameLocation =
      typeof lastComparedPoint !== "undefined" &&
      lastComparedPoint !== null &&
      Math.abs(lastComparedPoint.lat - lat) < 0.000001 &&
      Math.abs(lastComparedPoint.lng - lng) < 0.000001;

    const reuseImages = sameLocation && comparisonPairs.length > 0;

    mode = "compare";

    // 지구본 + SAR 패널 다시 표시
    globeScene.hidden = false;
    globeScene.classList.add("is-comparing");
    compareScene.hidden = false;

    resizeGlobe();

    if (globe) {
      stopRotation();

      // 지구본을 확대된 상태에 위치시킴
      globe.pointOfView({ lat, lng, altitude: CAMERA.map }, 0);

      // 다시 SAR 사진 화면 크기로 줌아웃
      requestAnimationFrame(() => {
        if (token !== viewToken) return;

        globe.pointOfView(
          { lat, lng, altitude: CAMERA.photo },
          reducedMotion.matches ? 0 : CAMERA.returnTime
        );
      });
    }

    // 기존 지도를 서서히 투명하게
    mapScene.classList.add("is-view-leaving");

    if (!reuseImages) {
      $("sarCompareGrid").hidden = true;
    }

    viewTimer = window.setTimeout(
      () => {
        if (token !== viewToken) return;

        mapScene.hidden = true;
        mapScene.classList.remove("is-view-leaving");

        // 같은 지역이면 기존 사진 유지
        if (reuseImages) return;

        // 지역이 변경되었다면 데이터 다시 검색
        openComparison(lat, lng);
      },
      reducedMotion.matches ? 0 : 650
    );
  }

  function openMap(lat, lng) {
    const token = resetViewMotion();

    mode = "transition-map";

    const duration = reducedMotion.matches ? 0 : CAMERA.mapTime;

    // 3D 지구본에서 깊은 줌인 시작
    globeScene.classList.add("is-map-zooming");

    if (globe) {
      stopRotation();

      globe.pointOfView(
        {
          lat,
          lng,
          altitude: CAMERA.map,
        },
        duration
      );
    }

    // 확대 완료 후 Leaflet 지도로 전환
    viewTimer = window.setTimeout(() => {
      if (token !== viewToken) return;

      // 지도 페이드인 준비
      mapScene.classList.add("is-view-entering");

      // 기존 지도 기능 실행
      openMapNow(lat, lng);

      // 지구본은 지도 뒤에 유지
      globeScene.hidden = false;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (token !== viewToken) return;

          mapScene.classList.remove("is-view-entering");
          globeScene.classList.remove("is-map-zooming");
        });
      });
    }, duration + 40);
  }

  function openMapNow(lat, lng) {
    clearTimeout(flyTimer);
    mode = "map";
    currentTarget = {
      lat,
      lng,
      name: isNearIIT(lat, lng) ? "Illinois Tech" : "Selected location",
    };
    globeScene.hidden = false;
    compareScene.hidden = true;
    mapScene.hidden = false;
    $("selectedPlace").textContent = currentTarget.name;
    $("selectedCoords").textContent = coordLabel(lat, lng);
    const near = isNearIIT(lat, lng);
    if (mobileLayout.matches) setLocationPanelExpanded(true);
    $("iitDataPanel").hidden = !near;
    $("outsideDataPanel").hidden = near;
    if (!initMap()) {
      $("selectedPlace").textContent = "Map library unavailable";
      $("selectedCoords").textContent =
        "Connect to the internet to load the detailed map.";
      return;
    }
    marker.setLatLng([lat, lng]);
    marker.bindPopup(`Selected location<br>${coordLabel(lat, lng)}`);
    if (near) {
      focusRing.setLatLng([IIT.lat, IIT.lng]);
      if (!map.hasLayer(focusRing)) focusRing.addTo(map);
    } else if (map.hasLayer(focusRing)) {
      map.removeLayer(focusRing);
    }

    requestAnimationFrame(() => {
      map.invalidateSize();

      const targetZoom = near ? 15 : 12;

      // 먼저 넓은 지역에서 시작
      map.setView([lat, lng], reducedMotion.matches ? targetZoom : 5, {
        animate: false,
      });

      // 해당 지역까지 부드럽게 확대
      if (!reducedMotion.matches) {
        requestAnimationFrame(() => {
          map.flyTo([lat, lng], targetZoom, {
            animate: true,
            duration: 1.25,
          });
        });
      }
    });

    refreshRasterLayers(near);
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

  function extractImageUrl(input) {
    try {
      // Preview API URL 또는 NASA 원본 URL 처리
      const parsed = new URL(input, window.location.origin);

      // ?url= 파라미터가 있으면 실제 이미지 URL 추출
      const rawUrl = parsed.searchParams.get("url") || parsed.href;

      const imageUrl = new URL(rawUrl);

      // NASA ASF 이미지 URL만 허용
      if (
        imageUrl.protocol !== "https:" ||
        imageUrl.hostname !== "nisar.asf.earthdatacloud.nasa.gov"
      ) {
        throw new Error("Invalid NASA image URL");
      }

      // 첫 이미지 확장자 뒤에 중복된 경로 제거
      const match = imageUrl.pathname.match(/\.(?:png|jpg|jpeg|webp)(?=\/|$)/i);

      if (!match) {
        throw new Error("Image extension not found");
      }

      imageUrl.pathname = imageUrl.pathname.slice(
        0,
        match.index + match[0].length
      );

      imageUrl.search = "";
      imageUrl.hash = "";

      return imageUrl.href;
    } catch (error) {
      console.error("Image URL extraction error:", error);
      return null;
    }
  }

  function extractImageUrl(input) {
    // /api/preview?url=... 에서 원본 URL 추출
    const parsed = new URL(input, window.location.origin);
    const rawUrl = parsed.searchParams.get("url") || parsed.href;

    const imageUrl = new URL(rawUrl);

    // NASA 이미지 주소 확인
    if (
      imageUrl.protocol !== "https:" ||
      imageUrl.hostname !== "nisar.asf.earthdatacloud.nasa.gov"
    ) {
      throw new Error("Invalid NASA image URL");
    }

    // 이미지 확장자 뒤에 중복 경로가 붙은 경우 제거
    const match = imageUrl.pathname.match(/\.(png|jpg|jpeg|webp)(?=\/|$)/i);

    if (match) {
      imageUrl.pathname = imageUrl.pathname.slice(
        0,
        match.index + match[0].length
      );
    }

    return imageUrl.href;
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
      const actualUrl = extractImageUrl(url);

      console.log("Original URL:", url);
      console.log("Extracted URL:", actualUrl);

      // NASA 이미지를 직접 표시
      image.src = actualUrl;
    } catch (err) {
      console.error(err);
      image.hidden = true;
      error.hidden = false;
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
      link.href = pair[item].browse;
      link.title = pair[item].id;
      setImage(item + "Image", item + "Error", pair[item].browse);
    }
  }

  async function openComparison(lat, lng) {
    clearTimeout(flyTimer);
    lastComparedPoint = { lat, lng };
    const requestId = ++comparisonRequestId;
    mode = "compare";
    currentTarget = {
      lat,
      lng,
      name: isNearIIT(lat, lng)
        ? "Illinois Tech · Chicago"
        : "Selected Earth region",
    };
    globeScene.hidden = false;
    globeScene.classList.add("is-comparing");
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
  function setBasemap(name) {
    if (!map || name === activeBasemap) return;
    if (name === "satellite") {
      if (map.hasLayer(streetsLayer)) map.removeLayer(streetsLayer);
      satelliteLayer.addTo(map);
    } else {
      if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
      streetsLayer.addTo(map);
    }
    activeBasemap = name;
    refreshRasterLayers(
      mode === "map" && isNearIIT(currentTarget.lat, currentTarget.lng)
    );
    if (beforeOverlay && map.hasLayer(beforeOverlay))
      beforeOverlay.bringToFront();
    if (afterOverlay && map.hasLayer(afterOverlay)) afterOverlay.bringToFront();
    $("streetLayer").classList.toggle("is-selected", name === "streets");
    $("satelliteLayer").classList.toggle("is-selected", name === "satellite");
  }

  // SAR raster overlays are opt-in and NOT simulated. Only validated, real imagery
  // may be placed in data/sar_layers.json. A missing file is an expected state.
  async function tryLoadSarLayers() {
    try {
      const result = await fetch("./data/sar_layers.json", {
        cache: "no-store",
      });
      if (!result.ok) return;
      const config = await result.json();
      const bounds = config.bounds;
      if (
        !config.before_image ||
        !config.after_image ||
        !Array.isArray(bounds) ||
        bounds.length !== 2
      )
        return;
      if (typeof L === "undefined" || !initMap()) return;
      beforeOverlay = L.imageOverlay(config.before_image, bounds, {
        opacity: 0.78,
        interactive: false,
      });
      afterOverlay = L.imageOverlay(config.after_image, bounds, {
        opacity: 0.4,
        interactive: false,
      });
      hasSARLayers = true;
      $("comparisonControls").hidden = false;
      $("rasterStatus").textContent = `${config.before_date || "Before"} / ${
        config.after_date || "After"
      }`;
      const badge = document.querySelector(".data-status");
      badge.classList.add("is-ready");
      badge.querySelector("span:last-child").textContent =
        "Prepared raster overlay loaded — review quality";
      badge.querySelector(".data-status-icon").textContent = "✓";
      $("compareSlider").addEventListener("input", (event) => {
        const opacity = Number(event.target.value) / 100;
        afterOverlay.setOpacity(opacity * 0.8);
        $("comparePct").textContent = `${Math.round(opacity * 100)}% after`;
      });
      refreshRasterLayers(
        mode === "map" && isNearIIT(currentTarget.lat, currentTarget.lng)
      );
    } catch (error) {
      // A missing data/sar_layers.json is completely normal for this demo.
      console.debug(
        "No optional SAR layers configured:",
        error?.message || error
      );
    }
  }
  function refreshRasterLayers(shouldShow) {
    if (!map || !hasSARLayers) return;
    for (const layer of [beforeOverlay, afterOverlay]) {
      if (shouldShow && !map.hasLayer(layer)) layer.addTo(map);
      if (!shouldShow && map.hasLayer(layer)) map.removeLayer(layer);
    }
    if (shouldShow) {
      marker.bringToFront();
      if (map.hasLayer(focusRing)) focusRing.bringToFront();
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
    $("resetGlobe").addEventListener("click", () => {
      clearTimeout(flyTimer);
      if (!globe) return;
      globe.pointOfView(START, 1000);
    });
    $("zoomInGlobe").addEventListener("click", () => globeZoom("in"));
    $("zoomOutGlobe").addEventListener("click", () => globeZoom("out"));
    $("streetLayer").addEventListener("click", () => setBasemap("streets"));
    $("satelliteLayer").addEventListener("click", () =>
      setBasemap("satellite")
    );
  }
  function start() {
    // 기존 비교 화면을 지구본 내부로 이동
    globeScene.appendChild(compareScene);

    // 닫기 버튼 이름 변경
    $("compareBack").textContent = "✕ Close";

    bindControls();
    initGlobe();
    // No API keys, SAR claims or mock detection results are embedded in the demo.
    // Delay optional config fetch to ensure Leaflet has been initialized from CDN.
    tryLoadSarLayers();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
