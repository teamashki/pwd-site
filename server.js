require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const SQUARE_TOKEN = process.env.SQUARE_ACCESS_TOKEN || '';
const SQUARE_BASE =
  process.env.SQUARE_ENV === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
const SQUARE_VERSION = '2024-06-04';
const LOCATION_ID = process.env.SQUARE_LOCATION_ID || '';
const SITE_URL = (process.env.SITE_URL || 'https://precisionwd.com').replace(/\/$/, '');

const readJson = (rel) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, rel), 'utf8'));

const htmlEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');

// Slug = readable name + last 6 chars of the Square ID, so links survive renames
const withSlug = (item) => ({
  ...item,
  images: item.images || (item.image ? [item.image] : []),
  slug: `${slugify(item.name)}-${String(item.id).slice(-6).toLowerCase()}`,
});

async function square(endpoint, body) {
  const res = await fetch(`${SQUARE_BASE}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${SQUARE_TOKEN}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Square ${endpoint} ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ——— inventory (Square catalog, 5-minute cache, sample fallback) ———

const cache = { data: null, at: 0 };
const CACHE_MS = 5 * 60 * 1000;

async function fetchSquareInventory() {
  const search = await square('/v2/catalog/search', {
    object_types: ['ITEM'],
    include_related_objects: true,
    limit: 100,
  });

  const related = search.related_objects || [];
  const images = new Map(
    related
      .filter((o) => o.type === 'IMAGE')
      .map((o) => [o.id, o.image_data && o.image_data.url])
  );

  // Categories are not returned as related objects — fetch them directly
  const categories = new Map(
    related
      .filter((o) => o.type === 'CATEGORY')
      .map((o) => [o.id, o.category_data && o.category_data.name])
  );
  try {
    const catList = await square('/v2/catalog/list?types=CATEGORY');
    for (const o of catList.objects || []) {
      categories.set(o.id, o.category_data && o.category_data.name);
    }
  } catch (err) {
    console.warn('Category list unavailable:', err.message);
  }

  const items = (search.objects || []).map((obj) => {
    const d = obj.item_data || {};
    const variation = (d.variations && d.variations[0]) || {};
    const vd = variation.item_variation_data || {};
    const price = vd.price_money || null;
    const itemImages = (d.image_ids || []).map((id) => images.get(id)).filter(Boolean);
    const categoryId =
      (d.categories && d.categories[0] && d.categories[0].id) || d.category_id;
    return {
      id: obj.id,
      variationId: variation.id || null,
      name: d.name || 'Untitled piece',
      description: d.description_plaintext || d.description || '',
      category: categories.get(categoryId) || 'Collection',
      price: price ? price.amount : null,
      currency: price ? price.currency : 'USD',
      image: itemImages[0] || null,
      images: itemImages,
      available: true,
    };
  });

  // Sold-out detection via inventory counts (best effort)
  if (LOCATION_ID && items.length) {
    try {
      const ids = items.map((i) => i.variationId).filter(Boolean);
      const counts = await square('/v2/inventory/counts/batch-retrieve', {
        catalog_object_ids: ids,
        location_ids: [LOCATION_ID],
      });
      const qty = new Map(
        (counts.counts || [])
          .filter((c) => c.state === 'IN_STOCK')
          .map((c) => [c.catalog_object_id, parseFloat(c.quantity || '0')])
      );
      for (const item of items) {
        if (item.variationId && qty.has(item.variationId)) {
          item.available = qty.get(item.variationId) > 0;
        }
      }
    } catch (err) {
      console.warn('Inventory counts unavailable:', err.message);
    }
  }

  return { source: 'square', items };
}

const sampleInventory = () => ({
  source: 'sample',
  items: readJson('data/sample-inventory.json').map(withSlug),
});

async function getInventory() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const raw = SQUARE_TOKEN ? await fetchSquareInventory() : sampleInventory();
    cache.data = { ...raw, items: raw.items.map(withSlug) };
    cache.at = Date.now();
    return cache.data;
  } catch (err) {
    console.error(err.message);
    // Serve stale cache or sample data rather than an empty page
    return cache.data || sampleInventory();
  }
}

app.get('/api/inventory', async (_req, res) => res.json(await getInventory()));

// ——— online checkout: create a Square-hosted payment link ———

app.post('/api/checkout', async (req, res) => {
  try {
    if (!SQUARE_TOKEN || !LOCATION_ID) {
      return res.status(503).json({ error: 'Checkout is not configured yet.' });
    }
    const { itemId } = req.body || {};
    const inv = await getInventory();
    const item = inv.items.find((i) => i.id === itemId);
    if (!item || item.price == null) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    if (!item.available) {
      return res.status(409).json({ error: 'This piece has sold.' });
    }
    const link = await square('/v2/online-checkout/payment-links', {
      idempotency_key: crypto.randomUUID(),
      quick_pay: {
        name: item.name,
        price_money: { amount: item.price, currency: item.currency },
        location_id: LOCATION_ID,
      },
    });
    res.json({ url: link.payment_link && link.payment_link.url });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Could not create checkout link.' });
  }
});

// ——— curated content ———

app.get('/api/config', (_req, res) => res.json(readJson('site.config.json')));
app.get('/api/reviews', (_req, res) => res.json(readJson('data/reviews.json')));
app.get('/api/gallery', (_req, res) => res.json(readJson('data/gallery.json')));

// ——— product detail pages: /piece/:slug ———

const absoluteUrl = (src) => (src && src.startsWith('/') ? SITE_URL + src : src);

function relatedPieces(items, piece) {
  const others = items.filter((i) => i.available && (!piece || i.id !== piece.id));
  const sameCategory = piece ? others.filter((i) => i.category === piece.category) : [];
  const rest = others.filter((i) => !sameCategory.includes(i));
  return [...sameCategory, ...rest].slice(0, 4);
}

function productJsonLd(piece, url, brand) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: piece.name,
    description: piece.description || undefined,
    image: piece.images.map(absoluteUrl),
    category: piece.category,
    brand: { '@type': 'Brand', name: brand },
  };
  if (piece.price != null) {
    data.offers = {
      '@type': 'Offer',
      url,
      price: (piece.price / 100).toFixed(2),
      priceCurrency: piece.currency || 'USD',
      availability: piece.available ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
    };
  }
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function renderPiecePage(piece, related, cfg) {
  const brand = cfg.brandName;
  const url = piece ? `${SITE_URL}/piece/${piece.slug}` : `${SITE_URL}/`;
  const description = piece
    ? (piece.description || `${piece.name}. Authenticated in hand and shipped fully insured.`).slice(0, 160)
    : 'This piece is no longer listed. Explore the current collection.';
  const vars = {
    TITLE: htmlEsc(piece ? `${piece.name} — ${brand}` : `Piece not found — ${brand}`),
    DESCRIPTION: htmlEsc(description),
    URL: htmlEsc(url),
    IMAGE: htmlEsc(absoluteUrl((piece && piece.images[0]) || '/images/brand/og-mark.png')),
    JSONLD: piece ? productJsonLd(piece, url, brand) : '{}',
    DATA: JSON.stringify({ piece, related, config: cfg }).replace(/</g, '\\u003c'),
  };
  const template = fs.readFileSync(path.join(__dirname, 'views/product.html'), 'utf8');
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

app.get('/piece/:slug', async (req, res) => {
  const cfg = readJson('site.config.json');
  const { items } = await getInventory();
  const slug = req.params.slug.toLowerCase();

  // Exact match, else match on the ID suffix (the piece was renamed in Square)
  let piece = items.find((i) => i.slug === slug);
  if (!piece && slug.length > 6) {
    piece = items.find((i) => i.slug.endsWith(`-${slug.slice(-6)}`));
  }
  if (piece && piece.slug !== slug) {
    return res.redirect(301, `/piece/${piece.slug}`);
  }

  res.status(piece ? 200 : 404).send(renderPiecePage(piece || null, relatedPieces(items, piece), cfg));
});

app.listen(PORT, () => {
  console.log(`Site running on http://localhost:${PORT}`);
  console.log(
    SQUARE_TOKEN
      ? `Square: connected (${process.env.SQUARE_ENV || 'production'})`
      : 'Square: no token set — serving sample inventory'
  );
});
