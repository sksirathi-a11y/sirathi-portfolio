document.getElementById('year').textContent = new Date().getFullYear();

// ===== Dark mode / light mode toggle =====
const themeToggle = document.getElementById('themeToggle');

function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

setTheme(document.documentElement.getAttribute('data-theme') || 'light');

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  setTheme(next);
});

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav-links');
navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ===== Portfolio grid: built from assets/img/manifest.json =====
const CATEGORY_LABELS = {
  'banner-ads': 'Banner Ads',
  'infographic': 'Infographic',
  'logo': 'Logo',
  'packaging': 'Packaging',
  'poster': 'Poster',
  'thumbnail': 'Thumbnail',
  'other': 'Other',
};
const CATEGORY_ORDER = ['banner-ads', 'infographic', 'logo', 'packaging', 'poster', 'thumbnail', 'other'];

const portfolioGrid = document.getElementById('portfolioGrid');
const filterBar = document.getElementById('filterBar');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxClose = document.getElementById('lightboxClose');

function openLightbox(card){
  const img = card.querySelector('img');
  const cat = card.querySelector('.card-cat')?.textContent || '';
  lightboxImg.src = img.src;
  lightboxImg.alt = img.alt;
  lightboxCaption.textContent = cat;
  lightbox.classList.add('open');
}

function closeLightbox(){
  lightbox.classList.remove('open');
  lightboxImg.src = '';
}

// The portfolio is a "horizontal masonry": cards pack left-to-right, in
// order, into a row until the next one would overflow the width - then
// that row is rescaled (same aspect ratios, just bigger/smaller) to land
// exactly on the container width, and the overflowing card starts a new
// row. Pages are built by exact content, not an estimate: cards are loaded
// in growing batches until a full ROWS_PER_PAGE rows are actually packed
// (or the filtered set runs out), so a page never ends up with a stray
// extra/missing row - it's measured, not guessed. Only one page of cards
// is in the DOM at a time; prev/next (or a swipe) slides to the next one.
const ROWS_PER_PAGE = 5;
const INITIAL_BATCH = 12; // cards to load+measure per growth step while filling a page
let allCards = [];
let currentFilter = 'all';
let currentPage = 0;
let pageStarts = [0]; // pageStarts[n] = index into the filtered list where page n begins
let currentPageIsLast = false;

const gridViewport = document.getElementById('gridViewport');
const gridPager = document.getElementById('gridPager');
const pagerPrev = document.getElementById('pagerPrev');
const pagerNext = document.getElementById('pagerNext');
const pagerCount = document.getElementById('pagerCount');

function getTargetRowHeight(){
  const w = window.innerWidth;
  if (w <= 420) return 145;
  if (w <= 640) return 175;
  if (w <= 1080) return 215;
  return 260;
}

function getVisibleCards(){
  return allCards.filter(card => currentFilter === 'all' || card.dataset.category === currentFilter);
}

function waitForImage(card){
  const img = card.querySelector('img');
  if (img.complete && img.naturalWidth) return Promise.resolve();
  return new Promise(resolve => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
  });
}

// Packs already-measured {card, ratio} items into rows left-to-right, in
// order, stopping as soon as `maxRows` full rows exist. Returns the rows
// built and how many items were actually consumed - anything left over
// (because it would have started row maxRows+1) is not consumed, so the
// caller can carry it into the next page instead of dropping it.
function packRows(items, maxRows){
  const rowHeight = getTargetRowHeight();
  const containerWidth = gridViewport.clientWidth;
  const rows = [];
  let row = [];
  let rowRatioSum = 0;
  let consumed = 0;

  for (let i = 0; i < items.length; i++){
    const item = items[i];
    if (rowRatioSum > 0 && (rowRatioSum + item.ratio) * rowHeight > containerWidth){
      rows.push(row);
      consumed = i;
      if (rows.length >= maxRows) return { rows, consumed };
      row = [];
      rowRatioSum = 0;
    }
    row.push(item);
    rowRatioSum += item.ratio;
  }
  if (row.length) rows.push(row);
  return { rows, consumed: items.length };
}

function renderRowsToPane(rows){
  const containerWidth = gridViewport.clientWidth;
  const maxHeight = getTargetRowHeight() * 1.35;
  const pane = document.createElement('div');
  pane.className = 'grid-pane';

  rows.forEach(row => {
    const rowRatioSum = row.reduce((sum, item) => sum + item.ratio, 0);
    // A trailing row with only one or two leftover cards needs very little
    // width at the target height, so stretching it edge-to-edge would blow
    // it up far taller than every other row. Cap the stretch instead - that
    // row just won't quite reach the right edge, which reads much better
    // than one oversized row at the bottom of the page.
    const finalHeight = Math.min(containerWidth / rowRatioSum, maxHeight);
    const rowEl = document.createElement('div');
    rowEl.className = 'justified-row';
    row.forEach(({ card, ratio }) => {
      card.style.width = `${ratio * finalHeight}px`;
      card.style.height = `${finalHeight}px`;
      rowEl.appendChild(card);
    });
    pane.appendChild(rowEl);
  });
  return pane;
}

// Builds one off-DOM page pane starting at `startIndex` in the filtered
// list. Loads (and measures) cards in growing batches until ROWS_PER_PAGE
// rows are actually packed, or the filtered list runs out - never guesses
// how many cards that will take.
function buildPageFromIndex(startIndex){
  const visible = getVisibleCards();
  if (startIndex >= visible.length) return Promise.resolve(null);

  const grow = (batchSize) => {
    const batchEnd = Math.min(startIndex + batchSize, visible.length);
    const batch = visible.slice(startIndex, batchEnd);
    return Promise.all(batch.map(waitForImage)).then(() => {
      const items = batch.map(card => {
        const img = card.querySelector('img');
        const ratio = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : 1;
        return { card, ratio };
      });
      const { rows, consumed } = packRows(items, ROWS_PER_PAGE);
      const reachedEnd = batchEnd >= visible.length;

      if (rows.length >= ROWS_PER_PAGE || reachedEnd){
        const nextIndex = startIndex + consumed;
        return { pane: renderRowsToPane(rows), nextIndex, isLastPage: nextIndex >= visible.length };
      }
      return grow(batchSize + INITIAL_BATCH);
    });
  };

  return grow(INITIAL_BATCH);
}

function updatePagerUI(){
  gridPager.classList.toggle('hidden', currentPage === 0 && currentPageIsLast);
  pagerCount.textContent = `${currentPage + 1}`;
  pagerPrev.disabled = currentPage === 0;
  pagerNext.disabled = currentPageIsLast;
}

// Full, un-animated (re)build: used for the first load, filter switches and
// resizes - these are a fresh view, not a "turn the page" gesture.
function renderGrid(){
  currentPage = 0;
  pageStarts = [0];
  portfolioGrid.classList.toggle('filtered', currentFilter !== 'all');

  return buildPageFromIndex(0).then(result => {
    portfolioGrid.classList.add('no-transition');
    portfolioGrid.innerHTML = '';
    portfolioGrid.style.width = '100%';
    portfolioGrid.style.transform = 'translateX(0%)';

    if (result){
      pageStarts[1] = result.nextIndex;
      currentPageIsLast = result.isLastPage;
      result.pane.style.flex = '0 0 100%';
      portfolioGrid.appendChild(result.pane);
    } else {
      currentPageIsLast = true;
    }

    void portfolioGrid.offsetWidth;
    portfolioGrid.classList.remove('no-transition');
    updatePagerUI();
  });
}

// Slides the current page out and the next/previous page in, like a
// carousel: the incoming pane sits right beside the current one and the
// whole track animates across by one pane-width.
function goToPage(delta){
  if (delta > 0 && currentPageIsLast) return;
  if (delta < 0 && currentPage === 0) return;

  const targetPage = currentPage + delta;
  const startIndex = pageStarts[targetPage];
  if (startIndex === undefined) return;

  buildPageFromIndex(startIndex).then(result => {
    const oldPane = portfolioGrid.firstElementChild;
    if (!result || !oldPane){ currentPage = targetPage; renderGrid(); return; }

    const newPane = result.pane;
    portfolioGrid.classList.add('no-transition');
    portfolioGrid.style.width = '200%';
    oldPane.style.flex = '0 0 50%';
    newPane.style.flex = '0 0 50%';

    if (delta > 0){
      portfolioGrid.appendChild(newPane);
      portfolioGrid.style.transform = 'translateX(0%)';
    } else {
      portfolioGrid.insertBefore(newPane, oldPane);
      portfolioGrid.style.transform = 'translateX(-50%)';
    }
    void portfolioGrid.offsetWidth;
    portfolioGrid.classList.remove('no-transition');

    requestAnimationFrame(() => {
      portfolioGrid.style.transform = delta > 0 ? 'translateX(-50%)' : 'translateX(0%)';
    });

    currentPage = targetPage;
    if (delta > 0) pageStarts[currentPage + 1] = result.nextIndex;
    currentPageIsLast = result.isLastPage;
    updatePagerUI();

    const onDone = () => {
      portfolioGrid.removeEventListener('transitionend', onDone);
      portfolioGrid.classList.add('no-transition');
      oldPane.remove();
      portfolioGrid.style.width = '100%';
      newPane.style.flex = '0 0 100%';
      portfolioGrid.style.transform = 'translateX(0%)';
      void portfolioGrid.offsetWidth;
      portfolioGrid.classList.remove('no-transition');
    };
    portfolioGrid.addEventListener('transitionend', onDone);
  });

  gridViewport.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

pagerPrev.addEventListener('click', () => { if (!pagerPrev.disabled) goToPage(-1); });
pagerNext.addEventListener('click', () => { if (!pagerNext.disabled) goToPage(1); });

let touchStartX = null;
portfolioGrid.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].clientX;
}, { passive: true });
portfolioGrid.addEventListener('touchend', (e) => {
  if (touchStartX === null) return;
  const delta = e.changedTouches[0].clientX - touchStartX;
  touchStartX = null;
  if (Math.abs(delta) < 50) return;
  if (delta < 0 && !pagerNext.disabled) goToPage(1);
  if (delta > 0 && !pagerPrev.disabled) goToPage(-1);
});

fetch('assets/img/manifest.json')
  .then(res => res.json())
  .then(manifest => {
    CATEGORY_ORDER.forEach(slug => {
      const files = manifest[slug] || [];
      files.forEach(filename => {
        const figure = document.createElement('figure');
        figure.className = 'card';
        figure.dataset.category = slug;

        const img = document.createElement('img');
        img.src = `assets/img/${slug}/${encodeURIComponent(filename)}`;
        img.alt = `${CATEGORY_LABELS[slug]} - ${filename}`;
        figure.appendChild(img);

        const figcaption = document.createElement('figcaption');
        const cat = document.createElement('span');
        cat.className = 'card-cat';
        cat.textContent = CATEGORY_LABELS[slug];
        figcaption.appendChild(cat);
        figure.appendChild(figcaption);

        allCards.push(figure);
      });
    });

    renderGrid();
  })
  .catch(err => console.error('Failed to load portfolio manifest:', err));

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { currentPage = 0; renderGrid(); }, 200);
});

// Filter buttons (event delegation - works regardless of how many cards exist)
filterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  currentPage = 0;
  renderGrid();
});

// Lightbox (event delegation on the grid so dynamically-added cards work too)
portfolioGrid.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) openLightbox(card);
});
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});
