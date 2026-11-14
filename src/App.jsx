import { useEffect } from 'react';
import { createExplorer } from '../app.js';
import { Topbar } from './components/Topbar.jsx';
import { GlobeScene } from './components/GlobeScene.jsx';
import { LocalMap } from './components/LocalMap.jsx';
import { Footer } from './components/Footer.jsx';
import { AboutDialog } from './components/AboutDialog.jsx';

const engineUrl = 'https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.mjs';
let enginePromise;
export function App() {
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
      <Topbar />
      <main className="main-content"><GlobeScene /><LocalMap /></main>
      <Footer />
    </div>
    <AboutDialog />
  </>;
}
