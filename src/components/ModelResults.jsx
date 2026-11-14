import { useEffect, useRef, useState } from 'react';
import { fetchJson } from '../lib/api.js';

function ResultCard({ result }) {
  const [failed, setFailed] = useState(false);
  return <article className="model-result-card">
    <h3>{result.title}</h3>
    <p>{result.observed_at} · {result.model_version} · {result.validation_status}</p>
    {failed ? <p role="status">Image unavailable. Reload results to refresh the link.</p>
      : <img src={result.image_url} alt={result.title} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    <p>{result.description}</p>
  </article>;
}

export function ModelResults() {
  const [state, setState] = useState({ loading: false, results: [], message: 'View available model-generated images.' });
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  async function load() {
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
  }
  return <section aria-labelledby="model-results-heading">
    <h3 id="model-results-heading">Model results</h3>
    <p id="modelResultsStatus" role="status" aria-live="polite">{state.message}</p>
    <button className="btn btn-outline" id="loadModelResults" type="button" disabled={state.loading} onClick={load}>Load / refresh results</button>
    <div id="modelResultsGallery">{state.results.map(result => <ResultCard key={`${result.id}:${result.image_url}`} result={result} />)}</div>
  </section>;
}
