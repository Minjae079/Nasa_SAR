import { useEffect, useRef } from 'react';
import { ModelResults } from './ModelResults.jsx';

export function ModelResultsDialog({ open, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [open]);
  return <dialog ref={dialog} className="model-results-dialog" onClose={onClose} aria-labelledby="model-results-title">
    <header className="model-results-header">
      <div><span className="section-tag">DEEPFLOOD · MODEL OUTPUT</span>
        <h2 id="model-results-title">Satellite analysis results</h2></div>
      <button type="button" className="btn btn-outline" onClick={onClose} aria-label="Close model results">✕ Close</button>
    </header>
    <p>Model-generated classifications of observed conditions. Experimental outputs are not confirmed flood reports or future rainfall forecasts.</p>
    <ModelResults active={open} />
  </dialog>;
}
