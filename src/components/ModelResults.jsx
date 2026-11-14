import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson } from '../lib/api.js';

function ResultCard({ result }) {
  const [failed, setFailed] = useState(false);
  return <article className="model-result-card">
    <h3>{result.title}</h3>
    <p>{result.observed_at} · {result.model_version} · {result.validation_status}</p>
    {failed ? <p role="status">Image unavailable. Reload results to refresh the link.</p>
      : <img src={result.image_url} alt={result.title} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    <p>{result.description}</p>
    {result.classes?.length > 0 && <ul className="model-legend" aria-label="Classification legend">
      {result.classes.map(item => <li key={item.id}><span style={{ backgroundColor: item.color }} />{item.name}</li>)}
      <li><span className="nodata-swatch" />Transparent: no valid observation</li>
    </ul>}
  </article>;
}

export function ModelResults({ active = false }) {
  const [state, setState] = useState({ loading: false, results: [], message: 'View available model-generated images.' });
  const request = useRef(null);
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => () => request.current?.abort(), []);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState(previous => ({ ...previous, loading: true, message: 'Loading model results…' }));
    try {
      const data = await fetchJson('/api/model-results', { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!Array.isArray(data.results)) throw new Error('Invalid result list');
      setState({ loading: false, results: data.results, message: data.results.length
        ? 'Model outputs are shown below. Reload to refresh expired image links.'
        : 'Model results are not available yet. Please check back later.' });
    } catch {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false,
        message: 'Unable to refresh results. Please try again later.' }));
    }
  }, []);
  useEffect(() => { if (active) load(); }, [active, load]);
  const selected = state.results.find(result => result.id === selectedId) || state.results[0];
  return <section aria-labelledby="model-results-heading">
    <h3 id="model-results-heading">Model results</h3>
    <p id="modelResultsStatus" role="status" aria-live="polite">{state.message}</p>
    <button className="btn btn-outline" id="loadModelResults" type="button" disabled={state.loading} onClick={load}>Load / refresh results</button>
    {state.results.length > 0 && <label className="model-result-select">Choose model output
      <select value={selected.id} onChange={event => setSelectedId(event.target.value)}>
        {state.results.map(result => <option key={result.id} value={result.id}>{result.title} · {result.observed_at}</option>)}
      </select>
    </label>}
    <div id="modelResultsGallery">{selected && <ResultCard key={`${selected.id}:${selected.image_url}`} result={selected} />}</div>
  </section>;
}
