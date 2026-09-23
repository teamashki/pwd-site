/* Piece (product detail) page. The server embeds the piece, related pieces,
   and site config as JSON in #piece-data, so the page renders without a fetch. */

const { piece, related = [], config = {} } = JSON.parse(
  document.getElementById('piece-data').textContent || '{}'
);
const email = (config.contact && config.contact.email) || '';
const instagram = (config.socials && config.socials.instagram) || '';

const $ = (id) => document.getElementById(id);

function renderNotFound() {
  document.querySelector('.pdp-grid').innerHTML = `
    <div class="pdp-missing">
      <p class="eyebrow">No longer listed</p>
      <h1 class="pdp-name">This piece has found its home.</h1>
      <p class="pdp-desc">It may have sold or been removed from the collection. Browse what's available now, or tell us what you're looking for and we'll source it.</p>
      <div class="pdp-actions">
        <a class="button-solid" href="/#collection">View the Collection</a>
        ${email ? `<a class="button-quiet" href="mailto:${esc(email)}?subject=${encodeURIComponent('Sourcing request')}">Request a Piece</a>` : ''}
      </div>
    </div>`;
  $('crumb-category').textContent = 'Not found';
  $('related-heading').textContent = 'Available now';
}

function renderGallery() {
  const stage = $('pdp-stage');
  const photos = piece.images || [];
  const total = photos.length;

  stage.innerHTML = total
    ? photos
        .map(
          (src, i) => `
        <figure class="pdp-slide">
          <img src="${esc(src)}" alt="${esc(piece.name)} — photo ${i + 1} of ${total}" ${i ? 'loading="lazy"' : ''} />
        </figure>`
        )
        .join('')
    : `<figure class="pdp-slide pdp-slide-empty">${placeholderMark('Photography coming soon')}</figure>`;

  $('pdp-sold').hidden = piece.available;
  if (total < 2) return;

  $('pdp-thumbs').innerHTML = photos
    .map(
      (src, i) => `
      <button class="pdp-thumb" type="button" data-index="${i}" aria-label="Show photo ${i + 1}" aria-current="${i === 0}">
        <img src="${esc(src)}" alt="" loading="lazy" />
      </button>`
    )
    .join('');

  const counter = $('pdp-counter');
  const prev = $('pdp-prev');
  const next = $('pdp-next');
  counter.hidden = prev.hidden = next.hidden = false;

  let current = 0;
  const setActive = (i) => {
    current = i;
    counter.textContent = `${i + 1} / ${total}`;
    document.querySelectorAll('.pdp-thumb').forEach((t) =>
      t.setAttribute('aria-current', String(Number(t.dataset.index) === i))
    );
  };
  const go = (i) => {
    const target = (i + total) % total;
    stage.scrollTo({ left: stage.clientWidth * target, behavior: 'smooth' });
    setActive(target);
  };

  setActive(0);
  stage.addEventListener(
    'scroll',
    () => {
      const i = Math.round(stage.scrollLeft / stage.clientWidth);
      if (i !== current) setActive(i);
    },
    { passive: true }
  );
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(current + 1);
    if (e.key === 'ArrowLeft') go(current - 1);
  });
  prev.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  $('pdp-thumbs').addEventListener('click', (e) => {
    const thumb = e.target.closest('[data-index]');
    if (thumb) go(Number(thumb.dataset.index));
  });
}

function renderInfo() {
  $('crumb-category').textContent = piece.category;
  $('pdp-category').textContent = piece.category;
  $('pdp-name').textContent = piece.name;
  $('pdp-price').textContent = piece.available ? money(piece.price, piece.currency) : 'Sold';
  $('pdp-desc').textContent = piece.description || '';
  $('pdp-desc').hidden = !piece.description;

  const buy = $('pdp-buy');
  const inquire = $('pdp-inquire');
  const pageUrl = window.location.href.split('#')[0];

  if (email) {
    const subject = piece.available ? `Inquiry: ${piece.name}` : `Similar to: ${piece.name}`;
    const body = `Hi, I'm interested in the ${piece.name}.\n\n${pageUrl}\n\n`;
    inquire.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  } else {
    inquire.hidden = true;
  }

  if (!piece.available || piece.price == null) {
    buy.hidden = true;
    $('pdp-note').hidden = true;
    inquire.className = 'button-solid';
    inquire.textContent = piece.available ? 'Inquire for Pricing' : 'Ask About Similar Pieces';
  }

  buy.addEventListener('click', async () => {
    const status = $('pdp-status');
    buy.disabled = true;
    buy.textContent = 'Preparing checkout…';
    status.textContent = '';
    try {
      await startCheckout(piece.id);
    } catch (err) {
      buy.disabled = false;
      buy.textContent = 'Purchase';
      status.textContent =
        err.message === 'This piece has sold.'
          ? 'This piece has just sold. Inquire and we’ll help you find a similar one.'
          : 'Online checkout isn’t available right now. Inquire and we’ll hold this piece for you.';
    }
  });

  if (instagram) {
    $('pdp-instagram').href = instagram;
    $('pdp-instagram').hidden = false;
  }

  const share = $('pdp-share');
  share.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: piece.name, url: pageUrl });
      } else {
        await navigator.clipboard.writeText(pageUrl);
        share.textContent = 'Link Copied';
        setTimeout(() => (share.textContent = 'Share This Piece'), 2000);
      }
    } catch {
      /* share sheet dismissed */
    }
  });
}

function renderRelated() {
  if (!related.length) {
    $('related').hidden = true;
    return;
  }
  $('related-grid').innerHTML = related.map(pieceCard).join('');
}

if (piece) {
  renderGallery();
  renderInfo();
} else {
  renderNotFound();
}
renderRelated();
