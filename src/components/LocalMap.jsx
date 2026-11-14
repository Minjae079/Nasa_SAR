
export function LocalMap() {
  return (<section id="mapScene" className="scene scene-map" hidden aria-label="Selected location detailed map">
        
        <div className="map-toolbar">
          <button className="btn btn-dark" id="backToGlobe">← <span>Back to globe</span></button>
          <button type="button" className="btn btn-dark" id="backToComparison">← SAR Photos</button>
          <div className="map-layer-toggle" role="group" aria-label="Map basemap">
            <button id="streetLayer" className="layer-button">Streets</button>
            <button id="satelliteLayer" className="layer-button is-selected">Satellite</button>
          </div>
        </div>
        <div className="location-card" id="locationCard">
          <button type="button" className="panel-toggle" id="toggleLocationPanel" aria-controls="locationPanelContent" aria-expanded="true"><span className="panel-toggle-handle" aria-hidden="true"></span><span id="panelToggleText">Hide location details</span><span className="panel-chevron" aria-hidden="true">⌄</span></button>
          <div id="locationPanelContent">
          <div className="location-kicker"><span className="small-green-dot"></span> LOCATION SELECTED</div>
          <div className="location-title-row"><h2 id="selectedPlace">Illinois Tech</h2><span className="pin-symbol">◎</span></div>
          <div className="location-coords" id="selectedCoords">41.83530° N · 87.62700° W</div>
          <div className="location-rule"></div>
          <div id="iitDataPanel">
            <span className="section-tag">NISAR DATA LAYERS</span>
            <h3>SAR change detection</h3>
            <p>Visualize the same area at two dates with calibrated radar data.</p>
            <div className="data-status"><span className="data-status-icon">!</span><span>Radar raster layers not loaded</span></div>
            <div className="data-rows">
              <div><span>Study area</span><strong>IIT · Chicago</strong></div>
              <div><span>Source</span><strong>NISAR L2 GCOV</strong></div>
              <div><span>Data status</span><strong id="rasterStatus">Awaiting GeoTIFF processing</strong></div>
            </div>
            <div className="comparison-controls" id="comparisonControls" hidden>
              <div className="comparison-title"><strong>Before / after</strong><span id="comparePct">50% after</span></div>
              <input id="compareSlider" type="range" min="0" max="100" defaultValue="50" aria-label="After raster visibility" />
              <div className="slider-labels"><span>Before</span><span>After</span></div>
            </div>
            <p className="data-disclaimer">Study-area circle is illustrative. No ground-change claims are made until real SAR raster data is validated.</p>
            <a className="data-link" href="https://search.asf.alaska.edu/" target="_blank" rel="noopener noreferrer">OPEN ASF DATA PORTAL ↗</a>
          </div>
          <div id="outsideDataPanel" hidden>
            <span className="section-tag">WORLD EXPLORATION</span>
            <h3>Explore any region</h3>
            <p>Zoom, pan, and switch basemaps. The prototype's study-area metadata is currently limited to Illinois Tech.</p>
            <button className="btn btn-primary" id="jumpToIITFromMap">View IIT study area ↗</button>
          </div>
          </div>
        </div>
        <div className="map-attribution-note">BASEMAP VISUALIZATION — NOT SAR MEASUREMENT</div>
      </section>);
}
