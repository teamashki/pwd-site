/* Shared helpers for the home page (app.js) and piece pages (product.js). */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const money = (cents, currency) =>
  cents == null
    ? 'Price on request'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
      }).format(cents / 100);

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

const placeholderMark = (caption) =>
  `<span class="placeholder-mark" aria-hidden="true"><img src="/images/brand/mark.svg" alt="" loading="lazy" /><em>${esc(caption)}</em></span>`;

// Collection card — the whole card links to the piece page
function pieceCard(item) {
  const images = item.images || (item.image ? [item.image] : []);
  const media = images.length
    ? `<img src="${esc(images[0])}" alt="${esc(item.name)}" loading="lazy" />` +
      (images[1] ? `<img class="piece-alt" src="${esc(images[1])}" alt="" loading="lazy" />` : '')
    : placeholderMark('Photo coming soon');
  return `
      <a class="piece" href="/piece/${esc(item.slug)}" data-category="${esc(item.category)}">
        <div class="piece-media">${media}${item.available ? '' : '<span class="piece-status sold">Sold</span>'}</div>
        <div class="piece-info">
          <span class="piece-category">${esc(item.category)}</span>
          <h3 class="piece-name">${esc(item.name)}</h3>
          ${item.description ? `<p class="piece-desc">${esc(item.description)}</p>` : ''}
          <div class="piece-foot">
            <span class="piece-price">${item.available ? money(item.price, item.currency) : 'Sold'}</span>
            <span class="piece-cta">View Piece</span>
          </div>
        </div>
      </a>`;
}

// Creates a Square-hosted payment link and sends the buyer there
async function startCheckout(itemId) {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.url) {
    window.location.href = data.url;
    return;
  }
  throw new Error(data.error || 'Checkout unavailable');
}

document.getElementById('footer-year').textContent = `© ${new Date().getFullYear()}`;
