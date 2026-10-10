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

// ===== English / Thai language toggle =====
// Every translatable element carries the exact markup for both languages in
// data-en/data-th (not just plain text) so a handful of elements with nested
// tags - the hero title's highlighted word, the bolded job titles - survive
// switching back and forth with no loss.
const langToggle = document.getElementById('langToggle');
const langButtons = langToggle.querySelectorAll('.lang-btn');

function setLanguage(lang){
  document.documentElement.setAttribute('lang', lang);
  document.querySelectorAll('[data-en]').forEach(el => {
    const html = lang === 'th' ? el.dataset.th : el.dataset.en;
    if (html !== undefined) el.innerHTML = html;
  });
  langButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
  langToggle.dataset.active = lang;
  localStorage.setItem('lang', lang);
}

setLanguage(document.documentElement.getAttribute('lang') || 'en');

langButtons.forEach(btn => {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
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

// Nav gains a solid background/blur once scrolled past the hero.
const siteHeader = document.querySelector('.site-header');
function updateHeaderScroll(){
  siteHeader.classList.toggle('scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', updateHeaderScroll, { passive: true });
updateHeaderScroll();

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
const CATEGORY_ORDER = ['infographic', 'banner-ads', 'logo', 'packaging', 'poster', 'thumbnail', 'other'];

const portfolioGrid = document.getElementById('portfolioGrid');
const filterBar = document.getElementById('filterBar');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxCount = document.getElementById('lightboxCount');

// The cards currently open in the lightbox (a snapshot of whatever page/
// filter was on screen when it opened), so prev/next can step through the
// same set the user was just browsing without re-querying mid-navigation.
let lightboxCards = [];
let lightboxIndex = -1;

function showLightboxCard(index){
  const card = lightboxCards[index];
  if (!card) return;
  lightboxIndex = index;
  const img = card.querySelector('img');
  lightboxImg.src = img.dataset.full || img.src;
  lightboxImg.alt = img.alt;

  const multiple = lightboxCards.length > 1;
  lightboxPrev.style.display = multiple ? '' : 'none';
  lightboxNext.style.display = multiple ? '' : 'none';
  lightboxCount.textContent = multiple ? `${index + 1} / ${lightboxCards.length}` : '';
}

function openLightbox(card){
  // Cards are dealt round-robin into .grid-column tracks (see
  // layoutMasonryColumns), so a plain DOM query would return them grouped
  // by column instead of in the left-to-right order they're displayed in -
  // .cardOrder (set on .grid-inner) is the real reading order to step
  // through with prev/next.
  const inner = card.closest('.grid-inner');
  lightboxCards = (inner && inner.cardOrder) ? inner.cardOrder : Array.from(portfolioGrid.querySelectorAll('.card'));
  showLightboxCard(lightboxCards.indexOf(card));
  lightbox.classList.add('open');
}

function closeLightbox(){
  lightbox.classList.remove('open');
  lightboxImg.src = '';
  lightboxCards = [];
  lightboxIndex = -1;
}

function stepLightbox(delta){
  if (!lightboxCards.length) return;
  showLightboxCard((lightboxIndex + delta + lightboxCards.length) % lightboxCards.length);
}

// A page is "the next N cards" in the filtered list. Only one page of cards
// is in the DOM at a time; prev/next (or a swipe) slides to the next one.
// N is the multiple of the current column count nearest to 15 - 15 itself
// on 3 or 5 columns, 16 on 2 or 4 - so every full page fills its rows
// exactly instead of leaving one card hanging off the end. It's fixed when
// the grid is (re)built (activePageSize) so page boundaries stay put while
// paging; a resize that changes the column count rebuilds from page 1.
const TARGET_PAGE_SIZE = 15;
function pageSizeForColumns(){
  const cols = masonryMetrics().cols;
  return Math.max(cols, Math.round(TARGET_PAGE_SIZE / cols) * cols);
}
let activePageSize = TARGET_PAGE_SIZE;
let rebuildAfterTransition = false;
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

function getVisibleCards(){
  return allCards.filter(card => currentFilter === 'all' || card.dataset.category === currentFilter);
}

const MASONRY_COLUMN_WIDTH = 208;
const MASONRY_COLUMN_GAP = 28;
const MASONRY_MOBILE_GAP = 12;

// Column count, width and gap for the current viewport. Wide enough for two
// fixed 208px columns: as many as fit. Narrower (phones): fixed-width
// columns would only fit one small column with empty space on both sides,
// so it's always two columns stretched to fill the width, with a tighter gap.
// The width/gap are handed to CSS as --col-w/--col-gap on .grid-inner.
function masonryMetrics(){
  const available = gridViewport.clientWidth;
  const fit = Math.floor((available + MASONRY_COLUMN_GAP) / (MASONRY_COLUMN_WIDTH + MASONRY_COLUMN_GAP));
  if (fit >= 2) return { cols: fit, width: MASONRY_COLUMN_WIDTH, gap: MASONRY_COLUMN_GAP };
  return { cols: 2, width: (available - MASONRY_MOBILE_GAP) / 2, gap: MASONRY_MOBILE_GAP };
}

// Rendered height of a card at the given column width, from its image's real
// proportions - null until the image has loaded (or if it failed to).
function cardHeight(card, width){
  const img = card.querySelector('img');
  if (!img || !img.complete || !img.naturalWidth) return null;
  return width * img.naturalHeight / img.naturalWidth;
}

function relayoutPane(pane){
  const inner = pane.querySelector('.grid-inner');
  if (inner && inner.cardOrder) layoutMasonryColumns(inner, inner.cardOrder);
}

// Builds N `.grid-column` tracks inside a `.grid-columns-row` and deals as
// many full rows of `cards` into them round-robin (card 0 -> column 0, card
// 1 -> column 1, ... card N -> column 0 again) as divide evenly. Leftover
// cards that don't fill a full row are placed one of two ways:
//  - Columns about equal in height (uniform images - reads as a plain grid):
//    a separate `.grid-tail-row` below, flex-centered inside `inner`'s width,
//    so the short last row sits exactly centered under the full rows.
//  - Columns uneven (mixed tall/short images): that separate row could only
//    start below the TALLEST column, leaving a big empty gap under every
//    shorter one. Instead the leftovers go straight into the middle columns,
//    packed directly under the cards above like the rest of the masonry.
// Column heights come from each image's real proportions, so they're only
// known once images have loaded - relayoutPane() re-runs this then.
//
// This used to be CSS `column-width` with the browser deciding both the
// column count (via column-fill:balance) and the reading order. Two
// problems came from that: balance reads column-by-column (finishes column
// 1 top-to-bottom before starting column 2) instead of left-to-right row by
// row like the manifest's real order: and for content that balances equally
// well multiple ways, the actual column count it picked wasn't stable
// between renders. Deciding the column count ourselves and building the
// columns explicitly fixes both - the order is exactly what round-robin
// assignment produces, and there's no browser balancing decision left to be
// unstable about. `inner.cardOrder` records the assignment order so the
// lightbox can step through cards in the same left-to-right sequence
// instead of DOM order (which is now grouped by column, not by row).
//
// When every card fits within a single row (a small category like Logo or
// Poster), reserving the full ideal column count would leave a column
// entirely empty - e.g. 4 cards in 5 reserved columns - and centering 4
// columns' worth of content inside a 5-column-wide block isn't centering on
// screen at all. Capping columns to the card count in that case means
// there's no reserved empty column to begin with (and no tail row either,
// since `cards.length` then divides evenly by `cols`), so the block's own
// width matches its content and .grid-pane's flex centering centers it
// exactly.
function layoutMasonryColumns(inner, cards){
  const { cols: idealCols, width, gap } = masonryMetrics();
  const cols = Math.max(1, Math.min(idealCols, cards.length));
  inner.innerHTML = '';
  inner.style.setProperty('--col-w', `${width}px`);
  inner.style.setProperty('--col-gap', `${gap}px`);

  const mainCount = Math.floor(cards.length / cols) * cols;
  const mainCards = cards.slice(0, mainCount);
  const tailCards = cards.slice(mainCount);

  const columnsRow = document.createElement('div');
  columnsRow.className = 'grid-columns-row';
  const columns = [];
  for (let i = 0; i < cols; i++){
    const col = document.createElement('div');
    col.className = 'grid-column';
    columns.push(col);
    columnsRow.appendChild(col);
  }
  mainCards.forEach((card, i) => columns[i % cols].appendChild(card));
  inner.appendChild(columnsRow);

  const colHeights = columns.map(col => {
    const heights = Array.from(col.children).map(card => cardHeight(card, width));
    if (heights.includes(null)) return null;
    return heights.reduce((a, b) => a + b, 0) + gap * (heights.length - 1);
  });
  const columnsEven = !colHeights.includes(null) &&
    Math.max(...colHeights) - Math.min(...colHeights) <= gap;

  if (tailCards.length && !columnsEven){
    const offset = Math.floor((cols - tailCards.length) / 2);
    tailCards.forEach((card, i) => columns[offset + i].appendChild(card));
  } else if (tailCards.length){
    const tailRow = document.createElement('div');
    tailRow.className = 'grid-tail-row';
    tailCards.forEach(card => {
      const col = document.createElement('div');
      col.className = 'grid-column';
      col.appendChild(card);
      tailRow.appendChild(col);
    });
    inner.appendChild(tailRow);
  }

  inner.style.width = `${cols * width + (cols - 1) * gap}px`;
  inner.cardOrder = cards;
}

// Builds one off-DOM page pane starting at `startIndex` in the filtered
// list. The src is only assigned here, the moment a card is actually about
// to be shown - not when the card is created - so the browser doesn't start
// downloading all ~1000+ portfolio images at once on first load.
function buildPageFromIndex(startIndex){
  const visible = getVisibleCards();
  if (startIndex >= visible.length) return Promise.resolve(null);

  const batchEnd = Math.min(startIndex + activePageSize, visible.length);
  const batch = visible.slice(startIndex, batchEnd);

  const pane = document.createElement('div');
  pane.className = 'grid-pane';
  const inner = document.createElement('div');
  inner.className = 'grid-inner';
  batch.forEach(card => {
    const img = card.querySelector('img');
    if (!img.src) img.src = img.dataset.src;
  });
  layoutMasonryColumns(inner, batch);
  pane.appendChild(inner);

  return Promise.resolve({ pane, nextIndex: batchEnd, isLastPage: batchEnd >= visible.length });
}

// `.card img` has no explicit aspect-ratio (that's the whole point of the
// masonry layout - it uses the image's real proportions), which means an
// image with no dimensions yet (still downloading) renders at 0 height, and
// so does the `.card` around it. Swapping in a page of unloaded images
// straight away - which is what used to happen - makes the grid collapse to
// a sliver for however long the images take to arrive over the network,
// then "pop" to full size all at once. Waiting for the batch to finish
// loading before revealing it keeps the skeleton (which has real, fixed
// heights) on screen for that entire window instead.
// `img.complete` (not naturalWidth) is what to check - naturalWidth stays 0
// forever on a broken/404 image, so checking it here would wait forever for
// a page that includes one; `complete` becomes true either way.
function waitForImages(pane){
  const imgs = Array.from(pane.querySelectorAll('img'));
  return Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));
}

// Fades + lifts each card into place with a small per-card stagger, so a
// fresh page reads as one flowing entrance instead of popping in at once.
function playEnterAnimation(pane){
  const cards = pane.querySelectorAll('.card');
  cards.forEach((card, i) => {
    card.classList.add('card-enter');
    card.style.transitionDelay = `${Math.min(i, 20) * 35}ms`;
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cards.forEach(card => card.classList.add('card-enter-active'));
    });
  });
  const cleanup = (card) => {
    card.classList.remove('card-enter', 'card-enter-active');
    card.style.transitionDelay = '';
  };
  cards.forEach(card => {
    card.addEventListener('transitionend', () => cleanup(card), { once: true });
  });
}

// True while a page-slide transition is animating and hasn't finished its
// DOM cleanup yet - see goToPage(), which uses this to ignore clicks/swipes
// that arrive before the current transition is done.
let pageTransitionInFlight = false;

function updatePagerUI(){
  gridPager.classList.toggle('hidden', currentPage === 0 && currentPageIsLast);
  pagerCount.textContent = `${currentPage + 1}`;
  // Leave the buttons hard-disabled while a transition is still in flight
  // (goToPage sets that directly) - only recompute the boundary-based
  // disabled state once nothing is animating.
  if (!pageTransitionInFlight){
    pagerPrev.disabled = currentPage === 0;
    pagerNext.disabled = currentPageIsLast;
  }
}

// Full, un-animated (re)build: used for the first load, filter switches and
// resizes - these are a fresh view, not a "turn the page" gesture.
function renderGrid(){
  currentPage = 0;
  pageStarts = [0];
  activePageSize = pageSizeForColumns();
  portfolioGrid.classList.toggle('filtered', currentFilter !== 'all');

  return buildPageFromIndex(0).then(result => {
    return (result ? waitForImages(result.pane) : Promise.resolve()).then(() => {
      if (result) relayoutPane(result.pane);
      portfolioGrid.classList.add('no-transition');
      portfolioGrid.innerHTML = '';
      portfolioGrid.style.width = '100%';
      portfolioGrid.style.transform = 'translateX(0%)';

      if (result){
        pageStarts[1] = result.nextIndex;
        currentPageIsLast = result.isLastPage;
        result.pane.style.flex = '0 0 100%';
        portfolioGrid.appendChild(result.pane);
        playEnterAnimation(result.pane);
      } else {
        currentPageIsLast = true;
      }

      void portfolioGrid.offsetWidth;
      portfolioGrid.classList.remove('no-transition');
      updatePagerUI();
    });
  });
}

// Slides the current page out and the next/previous page in, like a
// carousel: the incoming pane sits right beside the current one and the
// whole track animates across by one pane-width.
//
// Clicking/swiping again before that finishes used to start a second
// transition on top of the first - reassigning `transform` mid-animation
// cancels the browser's in-progress transition, so its `transitionend`
// (which is what removes the old pane from the DOM) never fires. Rapid
// clicks left several stale panes stacked up in #portfolioGrid forever,
// which is why the grid could look "stuck" even though the page counter
// had already moved on. `pageTransitionInFlight` makes goToPage a no-op
// until the current slide's cleanup has actually run.
function goToPage(delta){
  if (pageTransitionInFlight) return;
  if (delta > 0 && currentPageIsLast) return;
  if (delta < 0 && currentPage === 0) return;

  const targetPage = currentPage + delta;
  const startIndex = pageStarts[targetPage];
  if (startIndex === undefined) return;

  pageTransitionInFlight = true;
  pagerPrev.disabled = true;
  pagerNext.disabled = true;

  const releaseLock = () => {
    pageTransitionInFlight = false;
    updatePagerUI();
    if (rebuildAfterTransition){
      rebuildAfterTransition = false;
      renderGrid();
    }
  };

  buildPageFromIndex(startIndex).then(result => {
    const oldPane = portfolioGrid.firstElementChild;
    if (!result || !oldPane){ currentPage = targetPage; releaseLock(); renderGrid(); return; }

    return waitForImages(result.pane).then(() => {
      relayoutPane(result.pane);
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

      let settled = false;
      const onDone = () => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        portfolioGrid.removeEventListener('transitionend', onDone);
        portfolioGrid.classList.add('no-transition');
        oldPane.remove();
        portfolioGrid.style.width = '100%';
        newPane.style.flex = '0 0 100%';
        portfolioGrid.style.transform = 'translateX(0%)';
        void portfolioGrid.offsetWidth;
        portfolioGrid.classList.remove('no-transition');
        releaseLock();
      };
      portfolioGrid.addEventListener('transitionend', onDone);
      // Safety net: if transitionend somehow never fires (e.g. the tab was
      // backgrounded mid-animation), don't leave the pager permanently locked.
      const fallbackTimer = setTimeout(onDone, 900);
    });
  });
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

// Viewport width changes can change how many columns fit - re-deal each
// .grid-inner currently in the DOM (there are briefly two during a
// page-slide transition) into a fresh column count, using the same
// left-to-right order it was built with the first time. If the new column
// count needs a different page size, the pages themselves no longer line up
// with full rows, so rebuild from page 1 (after any slide in progress ends).
let resizeRaf = null;
window.addEventListener('resize', () => {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    document.querySelectorAll('.grid-inner').forEach(inner => {
      if (inner.cardOrder) layoutMasonryColumns(inner, inner.cardOrder);
    });
    if (allCards.length && pageSizeForColumns() !== activePageSize){
      if (pageTransitionInFlight) rebuildAfterTransition = true;
      else renderGrid();
    }
  });
});

// Shown immediately while the manifest + first batch of images are still
// loading, so the section never reads as empty/broken on first paint.
// renderGrid() below wipes portfolioGrid's contents as soon as the real
// page is ready, so this clears itself out automatically.
function renderSkeleton(){
  const pane = document.createElement('div');
  pane.className = 'grid-pane';
  pane.style.flex = '0 0 100%';
  const inner = document.createElement('div');
  inner.className = 'grid-inner';
  const skeletons = [];
  for (let i = 0, n = pageSizeForColumns(); i < n; i++){
    const sk = document.createElement('div');
    sk.className = 'skeleton-card';
    skeletons.push(sk);
  }
  layoutMasonryColumns(inner, skeletons);
  pane.appendChild(inner);
  portfolioGrid.appendChild(pane);
}
renderSkeleton();

// Every image URL below is cache-busted with "?v=<mtime>", but the manifest
// itself never was - a browser that cached an old manifest.json would keep
// listing files that were since deleted (they'd 404) or miss newly-added
// ones. Busting with the current load time forces a fresh fetch every time.
fetch(`assets/img/manifest.json?t=${Date.now()}`)
  .then(res => res.json())
  .then(manifest => {
    CATEGORY_ORDER.forEach(slug => {
      const files = manifest[slug] || {};
      Object.keys(files).forEach(filename => {
        const figure = document.createElement('figure');
        figure.className = 'card';
        figure.dataset.category = slug;

        const img = document.createElement('img');
        // "?v=" is the source file's mtime - replacing a file's content
        // under the same name is a common edit, and without a version tag
        // the URL never changes, so browsers keep serving what they already
        // cached for it.
        const version = files[filename];
        // The grid only ever needs a few hundred px per card, so it loads
        // the small pre-compressed copy - the multi-megabyte original is
        // only fetched when the lightbox opens (see dataset.full).
        img.dataset.src = `assets/img/thumbs/${slug}/${encodeURIComponent(filename)}?v=${version}`;
        img.dataset.full = `assets/img/${slug}/${encodeURIComponent(filename)}?v=${version}`;
        img.alt = `${CATEGORY_LABELS[slug]} - ${filename}`;
        figure.appendChild(img);

        allCards.push(figure);
      });

      // Hide a filter pill entirely when its category has no images right
      // now (e.g. everything in "Other" got removed) - an empty grid with
      // no cards and no message reads as a broken page, not an empty one.
      const filterBtn = filterBar.querySelector(`.filter-btn[data-filter="${slug}"]`);
      if (filterBtn) filterBtn.classList.toggle('hidden', Object.keys(files).length === 0);
    });

    renderGrid();
  })
  .catch(err => console.error('Failed to load portfolio manifest:', err));

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
lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); stepLightbox(-1); });
lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); stepLightbox(1); });
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') stepLightbox(1);
  if (e.key === 'ArrowLeft') stepLightbox(-1);
});

// ===== Scroll-reveal for major sections =====
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting){
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
