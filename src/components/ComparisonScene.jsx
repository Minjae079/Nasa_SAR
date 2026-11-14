
export function ComparisonScene() {
  return (<section id="compareScene" className="scene scene-compare" hidden aria-label="NASA SAR observation comparison">
        <div className="compare-top">
          
          <button type="button" className="btn btn-dark" id="compareBack">&#10005; Close</button>
          <div className="compare-title">
            <span className="section-tag">NASA NISAR · L2 GCOV</span>
            <h2 id="compareRegion">Selected region</h2>
            <p id="compareCoordinates">Choose a location on the globe</p>
          </div>
          <button type="button" className="btn btn-outline" id="compareMap">View local map</button>
        </div>
        <div className="compare-status" id="compareStatus" role="status" aria-live="polite">
          Searching NASA ASF coverage for two comparable acquisition dates…
        </div>
        <div className="compare-chooser" id="pairChooser" hidden>
          <label htmlFor="pairSelect">Matching orbit / frame</label>
          <select id="pairSelect"></select>
          <span id="pairCount"></span>
        </div>
        <div className="sar-compare-grid" id="sarCompareGrid" hidden>
          <article className="sar-photo-panel">
            <div className="sar-photo-heading"><div><span className="sar-kicker">01 / BEFORE</span><h3 id="beforeDate">—</h3></div><span className="sar-photo-pill">SAR BROWSE</span></div>
            <div className="sar-image-frame" id="beforeFrame"><img id="beforeImage" alt="Earlier NASA SAR observation preview" loading="eager"/><span className="sar-image-error" id="beforeError" hidden>NASA preview unavailable. Check data access or try another pair.</span></div>
            <div className="sar-file-meta"><span id="beforeMeta">—</span><a id="beforeSource" target="_blank" rel="noopener noreferrer">NASA source ↗</a></div>
          </article>
          <article className="sar-photo-panel">
            <div className="sar-photo-heading"><div><span className="sar-kicker">02 / AFTER · LATEST MATCHED</span><h3 id="afterDate">—</h3></div><span className="sar-photo-pill">SAR BROWSE</span></div>
            <div className="sar-image-frame" id="afterFrame"><img id="afterImage" alt="Later NASA SAR observation preview" loading="eager"/><span className="sar-image-error" id="afterError" hidden>NASA preview unavailable. Check data access or try another pair.</span></div>
            <div className="sar-file-meta"><span id="afterMeta">—</span><a id="afterSource" target="_blank" rel="noopener noreferrer">NASA source ↗</a></div>
          </article>
        </div>
        <div className="compare-footer-note" id="compareFootnote">
          <strong>Scientific note</strong> These are ASF full-scene browse images, not necessarily cropped to the clicked point or perfectly pixel-aligned. Image differences alone are not validated land-surface changes. For measurement, use co-registered GCOV numeric data and quality masks.
        </div>
      </section>);
}
