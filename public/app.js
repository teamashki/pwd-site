/* Home page. All content is data-driven: site.config.json (brand),
   /api/inventory (Square), /api/reviews, /api/gallery. Helpers live in common.js. */

/* ——— brand config ——— */

async function loadConfig() {
  const cfg = await getJSON('/api/config');
  document.querySelectorAll('[data-bind="brandName"]').forEach((el) => (el.textContent = cfg.brandName));
  document.querySelectorAll('[data-bind="brandShort"]').forEach((el) => (el.textContent = cfg.brandShort || cfg.brandName));
  document.querySelectorAll('[data-bind="tagline"]').forEach((el) => (el.textContent = cfg.tagline));
  document.title = `${cfg.brandName} — Fine Jewelry & Timepieces`;

  if (cfg.hero) {
    const h = document.getElementById('hero-headline');
    const { headline, emphasis } = cfg.hero;
    if (headline && emphasis && headline.includes(emphasis)) {
      h.innerHTML = `${esc(headline.slice(0, headline.indexOf(emphasis)))}<em>${esc(emphasis)}</em>`;
    } else if (headline) {
      h.textContent = headline;
    }
    if (cfg.hero.dek) document.querySelector('[data-bind="heroDek"]').textContent = cfg.hero.dek;
  }
  if (cfg.about) {
    document.querySelector('[data-bind="aboutHeading"]').textContent = cfg.about.heading;
    document.querySelector('[data-bind="aboutBody"]').textContent = cfg.about.body;
  }
  if (cfg.contact && cfg.contact.note) {
    document.querySelector('[data-bind="contactNote"]').textContent = cfg.contact.note;
  }
  renderContact(cfg);
  return cfg;
}

function renderContact(cfg) {
  const row = document.getElementById('contact-row');
  const c = cfg.contact || {};
  const s = cfg.socials || {};

  const primary = [];
  if (c.email) primary.push(['Email', `mailto:${c.email}`, c.email]);
  if (c.phone) primary.push(['Phone', `tel:${c.phone.replace(/[^+\d]/g, '')}`, c.phone]);
  if (c.location) primary.push(['Showroom', null, c.location]);

  const socials = [];
  if (s.instagram) socials.push(['Instagram', s.instagram, '@' + s.instagram.split('/').filter(Boolean).pop()]);
  if (s.facebook) socials.push(['Facebook', s.facebook, cfg.brandShort || 'Our page']);
  if (s.tiktok) socials.push(['TikTok', s.tiktok, '@' + s.tiktok.split('/').filter(Boolean).pop()]);

  const item = ([label, href, text]) => `
      <div class="contact-item">
        <span class="contact-label">${esc(label)}</span>
        ${href ? `<a href="${esc(href)}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(text)}</a>` : `<span>${esc(text)}</span>`}
      </div>`;

  row.innerHTML = `
      <div class="contact-group">${primary.map(item).join('')}</div>
      ${socials.length ? `<div class="contact-group">${socials.map(item).join('')}</div>` : ''}`;
}

/* ——— inventory ——— */

const pageSize = () => (window.matchMedia('(max-width: 820px)').matches ? 4 : 8);

// Returning from a piece page restores the filter, expanded count, and scroll position
const returning = history.state && history.state.collection;
if (returning) history.scrollRestoration = 'manual';

let allItems = [];
let activeFilter = returning ? returning.filter : 'All';
let visibleCount = returning ? returning.visible : pageSize();

function renderInventory() {
  const grid = document.getElementById('inventory-grid');
  const filtered =
    activeFilter === 'All' ? allItems : allItems.filter((i) => i.category === activeFilter);
  const items = filtered.slice(0, visibleCount);

  const wrap = document.getElementById('view-more-wrap');
  wrap.hidden = filtered.length <= visibleCount;
  document.getElementById('view-more-count').textContent =
    `Showing ${Math.min(visibleCount, filtered.length)} of ${filtered.length} pieces`;

  grid.innerHTML = items.map(pieceCard).join('');
}

function renderFilters() {
  const cats = ['All', ...new Set(allItems.map((i) => i.category))];
  const wrap = document.getElementById('filters');
  wrap.innerHTML = cats
    .map(
      (c) =>
        `<button class="filter-chip" data-filter="${esc(c)}" aria-pressed="${c === activeFilter}">${esc(c)}</button>`
    )
    .join('');
}

async function loadInventory() {
  const data = await getJSON('/api/inventory');
  allItems = data.items || [];
  if (!allItems.some((i) => i.category === activeFilter)) activeFilter = 'All';
  document.getElementById('collection-note').hidden = data.source !== 'sample';
  renderFilters();
  renderInventory();
  if (returning) window.scrollTo(0, returning.y);
}

document.getElementById('filters').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter]');
  if (!chip) return;
  activeFilter = chip.dataset.filter;
  visibleCount = pageSize();
  renderFilters();
  renderInventory();
});

document.getElementById('view-more').addEventListener('click', () => {
  visibleCount += pageSize();
  renderInventory();
});

document.getElementById('inventory-grid').addEventListener('click', (e) => {
  if (!e.target.closest('a.piece')) return;
  history.replaceState(
    { collection: { filter: activeFilter, visible: visibleCount, y: window.scrollY } },
    ''
  );
});

/* ——— gallery & reviews ——— */

async function loadGallery() {
  const items = await getJSON('/api/gallery');
  document.getElementById('gallery-row').innerHTML = items
    .map(
      (g) => `
      <div class="gallery-item">
        <figure>
          <img src="${esc(g.image)}" alt="${esc(g.title)}" loading="lazy" />
          <figcaption>
            <span class="gallery-title">${esc(g.title)}</span>
            <span class="gallery-note">${esc(g.note)}</span>
          </figcaption>
        </figure>
      </div>`
    )
    .join('');
}

async function loadReviews() {
  const reviews = await getJSON('/api/reviews');
  const sourceName = { google: 'Google Review', facebook: 'Facebook' };
  document.getElementById('reviews-grid').innerHTML = reviews
    .map(
      (r) => `
      <blockquote class="review">
        <span class="review-stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
        <p class="review-text">“${esc(r.text)}”</p>
        <footer class="review-meta">
          <span>${esc(r.name)}</span>
          <span class="review-source">${esc(sourceName[r.source] || r.source)}</span>
        </footer>
      </blockquote>`
    )
    .join('');
}

/* ——— boot ——— */

(async () => {
  try {
    await loadConfig();
  } catch (e) {
    console.error(e);
  }
  await Promise.allSettled([loadInventory(), loadGallery(), loadReviews()]);
})();
