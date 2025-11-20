const API_BASE = 'https://www.cheapshark.com/api/1.0';

const state = {
  page: 0,
  pageSize: 12,
  storeID: '',
  sort: '',
  query: '',
  loading: false,
  smallItems: [],
  smallPage: 0,
  smallPageSize: 5
};

const $ = selector => document.querySelector(selector);

const loadingEl = $('#loading');
const errorEl = $('#error');
const gridEl = $('#gamesGrid');
const loadMoreBtn = $('#loadMoreBtn');
const modal = $('#modal');
const modalContent = $('#modalContent');

const storeMap = {
  '1': 'Steam',
  '2': 'GOG',
  '3': 'Epic Games',
  '6': 'Humble'
};

let _lastFocusedElement = null;
let _trapListener = null;

function setLoading(on) {
  state.loading = on;
  loadingEl.classList.toggle('hidden', !on);
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.toggle('hidden', !msg);
}

async function fetchDeals({ page = 0, storeID = '', pageSize = 12, title = '' } = {}) {
  try {
    setLoading(true);
    showError('');

    const params = new URLSearchParams();
    if (storeID) params.set('storeID', storeID);
    params.set('pageNumber', String(page));
    params.set('pageSize', String(pageSize));
    if (title) params.set('title', title);

    const url = `${API_BASE}/deals?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Respuesta de la API no válida');
    const data = await res.json();
    return data;
  } catch (err) {
    showError('Error al cargar datos. Intenta recargar.');
    console.error(err);
    return null;
  } finally {
    setLoading(false);
  }
}

async function searchGames(title) {
  try {
    setLoading(true);
    showError('');
    const params = new URLSearchParams({ title, limit: '20' });
    const url = `${API_BASE}/games?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Busqueda fallida');
    const data = await res.json();
    return data; // array of games
  } catch (err) {
    showError('Error en la búsqueda.');
    console.error(err);
    return null;
  } finally {
    setLoading(false);
  }
}

function clearGrid() {
  gridEl.innerHTML = '';
}

function formatPrice(v) {
  const n = Number(v ?? 0);
  return `$${n.toFixed(2)}`;
}

function createCard(item) {
  // compact card layout (small image, title, price) used across the page
  const thumb = item.thumb || item.image || '';
  const title = item.title || item.external || item.name || 'Sin nombre';
  const salePrice = Number(item.salePrice ?? item.cheapest ?? item.cheapestPrice ?? 0);
  const normalPrice = Number(item.normalPrice ?? item.retailPrice ?? item.cheapest ?? salePrice);
  const discount = normalPrice > 0 ? Math.round((1 - salePrice / normalPrice) * 100) : 0;

  const container = document.createElement('article');
  container.className = 'hover-shadow';
  const imgHtml = `<img src="${thumb}" alt="${title}" class="card-img">`;
  const badgeHtml = discount > 0 ? `<div style="position:absolute;margin-top:-28px;margin-left:6px;background:#ff4d4d;color:white;padding:2px 6px;font-size:12px;border-radius:3px;">-${discount}%</div>` : '';
  const dealUrl = item.dealID ? `https://www.cheapshark.com/redirect?dealID=${item.dealID}` : (item.cheapestDealID ? `https://www.cheapshark.com/redirect?dealID=${item.cheapestDealID}` : '#');
  const storeBtn = dealUrl && dealUrl !== '#' ? `<a class="store-link" href="${dealUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;padding:6px 8px;background:#0f1724;color:#ffd9b8;border-radius:4px;text-decoration:none;font-weight:600;">Ir a tienda</a>` : '';

  container.innerHTML = `${imgHtml}${badgeHtml}<div class="compact-title">${title}</div><div class="compact-price">${formatPrice(salePrice)}</div>${storeBtn}`;

  // clicking the card opens modal. clicking the store link or the image should NOT open modal
  container.addEventListener('click', (e) => {
    if (e.target.closest && (e.target.closest('.store-link') || e.target.classList.contains('card-img'))) return;
    openDetail(item);
  });

  // make image open the deal in a new tab directly
  const imgEl = container.querySelector('.card-img');
  if (imgEl) {
    imgEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dealUrl && dealUrl !== '#') {
        window.open(dealUrl, '_blank', 'noopener');
      }
    });
  }
  return container;
}

function createSmallCard(item) {
  const thumb = item.thumb || item.image || '';
  const title = item.title || item.external || item.name || 'Sin nombre';
  const salePrice = Number(item.salePrice ?? item.cheapest ?? item.cheapestPrice ?? 0);
  const container = document.createElement('article');
  container.className = 'bg-slate-800 text-slate-100 rounded-md p-2 min-w-[160px] w-40 flex-shrink-0 hover-shadow';
  container.innerHTML = `
    <img src="${thumb}" alt="${title}" class="w-full h-20 object-cover rounded-sm mb-2">
    <h4 class="text-sm font-medium truncate">${title}</h4>
    <div class="text-sm text-indigo-300 font-semibold">${formatPrice(salePrice)}</div>
  `;
  container.addEventListener('click', () => openDetail(item));
  return container;
}

function renderDeals(list, append = false) {
  if (!Array.isArray(list) || list.length === 0) {
    if (!append) gridEl.innerHTML = '<p class="text-center text-slate-400">No se encontraron resultados.</p>';
    return;
  }

  if (!append) {
    clearGrid();
    const fragment = document.createDocumentFragment();
    for (const item of list) {
      fragment.appendChild(createCard(item));
    }
    gridEl.appendChild(fragment);
  } else {
    const fragment = document.createDocumentFragment();
    for (const item of list) fragment.appendChild(createCard(item));
    gridEl.appendChild(fragment);
  }
}

function renderSmallPage() {
  const smallRow = document.getElementById('smallRow');
  smallRow.innerHTML = '';
  const start = state.smallPage * state.smallPageSize;
  const pageItems = state.smallItems.slice(start, start + state.smallPageSize);
  for (const s of pageItems) {
    smallRow.appendChild(createSmallCard(s));
  }
  updateSmallControls();
}

function updateSmallControls() {
  const prev = document.getElementById('smallPrevBtn');
  const next = document.getElementById('smallNextBtn');
  const totalPages = Math.max(1, Math.ceil(state.smallItems.length / state.smallPageSize));
  prev.disabled = state.smallPage <= 0;
  next.disabled = state.smallPage >= totalPages - 1;
}

document.addEventListener('DOMContentLoaded', () => {
  const prev = document.getElementById('smallPrevBtn');
  const next = document.getElementById('smallNextBtn');
  prev.addEventListener('click', () => {
    if (state.smallPage > 0) {
      state.smallPage -= 1;
      renderSmallPage();
    }
  });
  next.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(state.smallItems.length / state.smallPageSize));
    if (state.smallPage < totalPages - 1) {
      state.smallPage += 1;
      renderSmallPage();
    }
  });
});

function openDetail(item) {
  const title = item.title || item.external || item.name || 'Sin nombre';
  const thumb = item.thumb || item.image || '';
  const salePrice = Number(item.salePrice ?? item.cheapest ?? item.cheapestPrice ?? 0);
  const normalPrice = Number(item.normalPrice ?? item.retailPrice ?? item.cheapest ?? salePrice);
  const discount = normalPrice > 0 ? Math.round((1 - salePrice / normalPrice) * 100) : 0;
  const dealUrl = item.dealID ? `https://www.cheapshark.com/redirect?dealID=${item.dealID}` : (item.cheapestDealID ? `https://www.cheapshark.com/redirect?dealID=${item.cheapestDealID}` : '#');
  const storeName = item.storeID ? (storeMap[item.storeID] || `ID ${item.storeID}`) : 'Varios';

  modalContent.innerHTML = `
    <div class="flex flex-col md:flex-row gap-4">
      <img src="${thumb}" class="w-full md:w-48 h-48 object-cover rounded-md" alt="${title}" />
      <div>
        <h2 class="text-xl font-semibold">${title}</h2>
        <p class="text-sm text-slate-600 mt-2">Tienda: <strong>${storeName}</strong></p>
        <p class="text-sm text-slate-600 mt-2">Precio oferta: <strong class="text-indigo-600">${formatPrice(salePrice)}</strong></p>
        <p class="text-sm text-slate-500">Precio normal: <span class="line-through">${formatPrice(normalPrice)}</span></p>
        ${discount > 0 ? `<p class="mt-2 text-sm text-green-600">Ahorra ${discount}%</p>` : ''}
        <div class="mt-4">
          <a class="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md" target="_blank" rel="noopener" href="${dealUrl}">Ir a la oferta</a>
        </div>
      </div>
    </div>
  `;

  // manage focus trap
  _lastFocusedElement = document.activeElement;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  const closeBtn = document.getElementById('closeModal');
  if (closeBtn) closeBtn.classList.add('focus-outline');
  // focus the close button
  closeBtn?.focus();

  // trap focus inside modal
  _trapListener = function(e) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(modal.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'))
      .filter(el => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  };
  document.addEventListener('keydown', _trapListener);
}

function closeModal() {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  // remove trap listener and restore focus
  if (_trapListener) {
    document.removeEventListener('keydown', _trapListener);
    _trapListener = null;
  }
  if (_lastFocusedElement && typeof _lastFocusedElement.focus === 'function') {
    _lastFocusedElement.focus();
    _lastFocusedElement = null;
  }
}

async function initialLoad() {
  const data = await fetchDeals({ page: state.page, storeID: state.storeID, pageSize: state.pageSize });
  if (data) renderDeals(data, false);
}

// Event bindings
$('#searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('#searchInput').value.trim();
  state.query = q;
  state.page = 0;
  if (!q) {
    const data = await fetchDeals({ page: 0, storeID: state.storeID, pageSize: state.pageSize });
    if (data) renderDeals(data, false);
    return;
  }

  const results = await searchGames(q);
  if (results) {
    // map /games results into card-like objects
    renderDeals(results.map(r => ({
      thumb: r.thumb,
      external: r.external,
      title: r.external || r.name || r.title,
      cheapest: r.cheapest,
      salePrice: r.cheapest,
      cheapestDealID: r.cheapestDealID
    })), false);
  }
});

$('#storeSelect').addEventListener('change', async (e) => {
  state.storeID = e.target.value;
  state.page = 0;
  const data = await fetchDeals({ page: 0, storeID: state.storeID, pageSize: state.pageSize });
  if (data) renderDeals(data, false);
});

$('#sortSelect').addEventListener('change', (e) => {
  state.sort = e.target.value;
  // simple client-side sort by reading prices rendered
  const cards = Array.from(gridEl.children);
  const items = cards.map(card => {
    const priceEl = card.querySelector('.text-indigo-600');
    const priceText = priceEl?.textContent?.replace('$','') || '0';
    return { card, price: Number(priceText) };
  });
  if (state.sort === 'priceAsc') items.sort((a,b) => a.price - b.price);
  if (state.sort === 'priceDesc') items.sort((a,b) => b.price - a.price);
  gridEl.innerHTML = '';
  items.forEach(i => gridEl.appendChild(i.card));
});

loadMoreBtn.addEventListener('click', async () => {
  state.page += 1;
  const data = await fetchDeals({ page: state.page, storeID: state.storeID, pageSize: state.pageSize });
  if (data) renderDeals(data, true);
});

$('#closeModal').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// close modal with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Start
document.addEventListener('DOMContentLoaded', initialLoad);
