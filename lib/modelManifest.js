export class InvalidManifestError extends Error {}

export function parseModelManifest(value) {
  const fail = () => { throw new InvalidManifestError(); };
  if (!value || value.version !== 1 || !Array.isArray(value.results) || value.results.length > 100) fail();
  const ids = new Set();
  return value.results.filter(row => row?.published === true).map(row => {
    if (typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) || ids.has(row.id)) fail();
    ids.add(row.id);
    // Only PNGs in the dedicated publication prefix can be signed by this API.
    if (typeof row.image_path !== 'string' ||
        !/^results\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.png$/.test(row.image_path) ||
        row.image_path.split('/').some(part => part.startsWith('.'))) fail();
    for (const key of ['title', 'observed_at', 'model_version', 'description']) {
      if (typeof row[key] !== 'string' || row[key].length > (key === 'description' ? 2000 : 200)) fail();
    }
    if (!row.title.trim() || !row.model_version.trim() || !Number.isFinite(Date.parse(row.observed_at))) fail();
    return { id: row.id, title: row.title, observed_at: row.observed_at,
      model_version: row.model_version, description: row.description,
      validation_status: row.validation_status === 'validated' ? 'validated' : 'experimental',
      image_path: row.image_path };
  });
}
