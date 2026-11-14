import { useEffect, useState } from 'react';
import { createExplorer } from '../app.js';
import { Topbar } from './components/Topbar.jsx';
import { GlobeScene } from './components/GlobeScene.jsx';
import { LocalMap } from './components/LocalMap.jsx';
import { Footer } from './components/Footer.jsx';
import { AboutDialog } from './components/AboutDialog.jsx';
import { ModelResultsDialog } from './components/ModelResultsDialog.jsx';

const engineUrl = 'https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.mjs';
let enginePromise;
export function App() {
  const [showResults, setShowResults] = useState(false);
  function openResults() {
    // The existing controller owns the legacy About overlay only.
    document.getElementById('aboutModal').hidden = true;
    setShowResults(true);
  }
  useEffect(() => {
    let cancelled = false;
    let explorer;
    // Keep one map engine and one imperative map instance. React owns the shell;
    // the map controller exclusively owns map rendering and geographic controls.
    enginePromise ??= import(/* @vite-ignore */ engineUrl);
    enginePromise.then(engine => {
      if (cancelled) return;
      explorer = createExplorer(engine);
      explorer.start();
    }).catch(error => {
      if (cancelled) return;
      console.error('Map engine unavailable', error);
      // Navigation and the model result viewer still work without WebGL/CDN.
      explorer = createExplorer(undefined);
      explorer.start();
    });
    return () => { cancelled = true; explorer?.destroy(); };
  }, []);

  return <>
    <div className="site-frame">
      <Topbar onOpenModelResults={openResults} />
      <main className="main-content"><GlobeScene onOpenModelResults={openResults} /><LocalMap /></main>
      <Footer />
    </div>
    <AboutDialog onOpenModelResults={openResults} />
    <ModelResultsDialog open={showResults} onClose={() => setShowResults(false)} />
  </>;
}
