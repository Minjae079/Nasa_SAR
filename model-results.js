const loadButton = document.getElementById('loadModelResults');
const message = document.getElementById('modelResultsStatus');
const gallery = document.getElementById('modelResultsGallery');

loadButton.addEventListener('click', async () => {
  loadButton.disabled = true;
  gallery.replaceChildren();
  message.textContent = 'Loading model results…';
  try {
    const response = await fetch('/api/model-results', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) throw new Error();
    if (!data.results.length) {
      message.textContent = 'Model results are not available yet. Please check back later.';
      return;
    }
    message.textContent = 'Model outputs are shown below. Reload to refresh expired image links.';
    for (const result of data.results) {
      const card = document.createElement('article');
      const title = document.createElement('h3');
      title.textContent = result.title;
      const meta = document.createElement('p');
      meta.textContent = `${result.observed_at} · ${result.model_version} · ${result.validation_status}`;
      const image = document.createElement('img');
      image.alt = result.title;
      image.loading = 'lazy';
      image.style.cssText = 'display:block;width:100%;height:auto;border-radius:8px';
      const imageError = document.createElement('p');
      imageError.hidden = true;
      imageError.textContent = 'Image unavailable. Reload the results to try again.';
      image.addEventListener('error', () => { image.hidden = true; image.style.display = 'none'; imageError.hidden = false; });
      image.src = result.image_url;
      const description = document.createElement('p');
      description.textContent = result.description;
      card.append(title, meta, image, imageError, description);
      gallery.append(card);
    }
  } catch { message.textContent = 'Unable to load model results. Please try again later.'; }
  finally { loadButton.disabled = false; }
});
