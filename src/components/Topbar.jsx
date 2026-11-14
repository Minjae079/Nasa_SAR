
export function Topbar({ onOpenModelResults }) {
  return (<header className="topbar">
      <button className="brand" id="brandHome" aria-label="Return to the globe">
        <span className="brand-icon" aria-hidden="true"><span className="brand-orbit"></span><span className="brand-dot"></span></span>
        <span>SAR<span className="brand-secondary">SCOPE</span><span className="brand-period">.</span></span>
      </button>
      <nav className="topnav" aria-label="Main navigation">
        <button className="topnav-item is-active" id="navExplore">Explore</button>
        <button className="topnav-item" id="navHow">How it works</button>
        <a className="topnav-item" href="https://search.asf.alaska.edu/" target="_blank" rel="noopener noreferrer">NASA / ASF data <span aria-hidden="true">↗</span></a>
      </nav>
      <button className="mobile-about" id="mobileAbout" type="button" aria-label="About this project">About <span aria-hidden="true">ⓘ</span></button>
      <button className="model-results-launch" type="button" onClick={onOpenModelResults}>Model results</button>
      <div className="header-right">
        <span className="live-dot"></span>
        <span>NASA DATA PREVIEW · EXPERIMENTAL</span>
        <span className="version">v0.2</span>
      </div>
    </header>);
}
