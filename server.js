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

const readJson = (rel) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, rel), 'utf8'));

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
    const imageId = (d.image_ids || [])[0];
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
      image: images.get(imageId) || null,
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

app.get('/api/inventory', async (_req, res) => {
  try {
    if (cache.data && Date.now() - cache.at < CACHE_MS) {
      return res.json(cache.data);
    }
    let data;
    if (SQUARE_TOKEN) {
      data = await fetchSquareInventory();
    } else {
      data = { source: 'sample', items: readJson('data/sample-inventory.json') };
    }
    cache.data = data;
    cache.at = Date.now();
    res.json(data);
  } catch (err) {
    console.error(err.message);
    // Serve stale cache or sample data rather than an empty page
    if (cache.data) return res.json(cache.data);
    res.json({ source: 'sample', items: readJson('data/sample-inventory.json') });
  }
});

// ——— online checkout: create a Square-hosted payment link ———

app.post('/api/checkout', async (req, res) => {
  try {
    if (!SQUARE_TOKEN || !LOCATION_ID) {
      return res.status(503).json({ error: 'Checkout is not configured yet.' });
    }
    const { itemId } = req.body || {};
    const inv = cache.data && cache.data.source === 'square' ? cache.data : await fetchSquareInventory();
    const item = inv.items.find((i) => i.id === itemId);
    if (!item || item.price == null) {
      return res.status(404).json({ error: 'Item not found.' });
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

app.listen(PORT, () => {
  console.log(`Site running on http://localhost:${PORT}`);
  console.log(
    SQUARE_TOKEN
      ? `Square: connected (${process.env.SQUARE_ENV || 'production'})`
      : 'Square: no token set — serving sample inventory'
  );
});
