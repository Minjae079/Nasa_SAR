import { ConnectionStatus } from './ConnectionStatus.jsx';
import { ModelResults } from './ModelResults.jsx';

export function AboutDialog() {
  return (<div id="aboutModal" className="modal-backdrop" hidden>
    <section className="about-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <button className="modal-close" id="closeAbout" aria-label="Close dialog">×</button>
      <span className="eyebrow"><span className="eyebrow-line"></span> HOW IT WORKS</span>
      <h2 id="modalTitle">From globe to ground.</h2>
      <p>Use your mouse or touch to rotate the 3D Earth. Click any location to fly toward it and open a zoomable local map. The Illinois Tech shortcut takes you straight to the planned study area.</p>
      <div className="modal-steps">
        <div><span>01</span><strong>Explore the globe</strong><p>Rotate, zoom, and choose a location.</p></div>
        <div><span>02</span><strong>Inspect the location</strong><p>Switch between street and satellite basemaps.</p></div>
        <div><span>03</span><strong>Compare NISAR imagery</strong><p>Use ASF search results to display two matched GCOV observation previews. Numeric change detection requires further processing.</p></div>
      </div>
      <div className="modal-caution">This is a learning/prototyping interface. It does not yet detect surface changes. Verify hackathon pre-work rules before incorporating code into a competition submission.</div>
      <ConnectionStatus /><hr /><ModelResults />
      <button className="btn btn-primary" id="startExplore">Start exploring <span>↗</span></button>
    </section>
  </div>);
}
