// ============================================================
// GUIDE PAGE CONTROLLER
// Right-side sidebar lists every product (from PRODUCTS) as a
// collapsible heading, with that product's guideSections as
// sub-tabs underneath. Clicking a sub-tab LOADS that section's
// content into the main panel (replaces it, doesn't just scroll to
// an anchor) and recolors headings to that product's accent via
// setAccent(). Everything here is generated from data — there is
// no per-product markup anywhere in this file or guide.html.
// ============================================================

const guideMain = document.getElementById('guideMain');
const guideSidebar = document.getElementById('guideSidebar');

/* ---------- build the sidebar ------------------------------------- */
const productsList = window.PRODUCTS || [];
const drawerHeadHtml = `
  <div class="gnav-drawer-head">
    <div class="gnav-drawer-title"><i class="fa-solid fa-book-open"></i> Guide Sections</div>
    <button class="gnav-drawer-close" id="gnavCloseBtn" type="button" aria-label="Close sections"><i class="fa-solid fa-xmark"></i></button>
  </div>
`;
guideSidebar.innerHTML = drawerHeadHtml + productsList.map(product => `
  <div class="gnav-product" data-product="${product.id}">
    <div class="gnav-heading" data-product-toggle="${product.id}">
      <span style="display:flex;align-items:center;gap:0.55rem"><span class="gnav-dot"></span>${product.name}</span>
      <a href="bundle.html?product=${product.id}#pricing" class="gnav-buy" onclick="event.stopPropagation()">Buy</a>
    </div>
    <div class="gnav-sublist collapsed" data-product-sublist="${product.id}">
      ${(product.guideSections || []).map((g, i) => `
        <button class="gnav-item" type="button" data-product="${product.id}" data-section="${g.id}">${String(i + 1).padStart(2, '0')} · ${g.title}</button>
      `).join('')}
    </div>
  </div>
`).join('');

/* ---------- render one section into the main panel ------------------ */
function loadSection(productId, sectionId) {
  const product = (window.PRODUCTS_BY_ID && window.PRODUCTS_BY_ID[productId]) || (window.PRODUCTS && window.PRODUCTS.find(p => p.id === productId));
  if (!product) return;
  const group = (product.guideSections || []).find(g => g.id === sectionId);
  if (!group) return;

  setAccent(product);
  guideMain.innerHTML = renderGuideGroup(group, product);

  const buyHref = `bundle.html?product=${productId}#pricing`;
  const tbBuy = document.getElementById('tbBuyLink');
  const footerBuy = document.getElementById('footerBuyLink');
  if (tbBuy) tbBuy.href = buyHref;
  if (footerBuy) footerBuy.href = buyHref;

  guideSidebar.querySelectorAll('.gnav-heading').forEach(h =>
    h.classList.toggle('active', h.dataset.productToggle === productId));
  guideSidebar.querySelectorAll('.gnav-item').forEach(a =>
    a.classList.toggle('active', a.dataset.product === productId && a.dataset.section === sectionId));

  guideSidebar.querySelectorAll('.gnav-sublist').forEach(list =>
    list.classList.toggle('collapsed', list.dataset.productSublist !== productId));

  window.scrollTo({ top: guideMain.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  refreshRevealObserver();
}

/* ---------- clicks: expand/collapse product, load a section --------- */
guideSidebar.addEventListener('click', (e) => {
  const toggle = e.target.closest('[data-product-toggle]');
  if (toggle) {
    const id = toggle.dataset.productToggle;
    const sublist = guideSidebar.querySelector(`[data-product-sublist="${id}"]`);
    const wasCollapsed = sublist.classList.contains('collapsed');
    guideSidebar.querySelectorAll('.gnav-sublist').forEach(l => l.classList.add('collapsed'));
    if (wasCollapsed) {
      sublist.classList.remove('collapsed');
      const product = (window.PRODUCTS_BY_ID && window.PRODUCTS_BY_ID[id]) || (window.PRODUCTS && window.PRODUCTS.find(p => p.id === id));
      if (product && product.guideSections && product.guideSections[0]) {
        loadSection(id, product.guideSections[0].id);
      }
    }
    return;
  }

  const item = e.target.closest('.gnav-item');
  if (item) {
    loadSection(item.dataset.product, item.dataset.section);
    if (window.innerWidth <= 1000) closeDrawer();
  }
});

/* ---------- initial load: honor ?product=&#section from the URL ----- */
(function initialLoad(){
  const params = new URLSearchParams(location.search);
  const requestedProduct = params.get('product');
  const requestedSection = location.hash ? location.hash.slice(1) : null;

  const product = (requestedProduct && window.PRODUCTS_BY_ID && window.PRODUCTS_BY_ID[requestedProduct]) || (window.PRODUCTS && window.PRODUCTS[0]);
  if (!product) return;
  const section = (requestedSection && product.guideSections && product.guideSections.find(g => g.id === requestedSection))
    ? requestedSection
    : (product.guideSections && product.guideSections[0] ? product.guideSections[0].id : null);

  if (section) loadSection(product.id, section);
})();

/* ---------- sidebar collapse/expand toggle ---------------------------
   Same dual-class trick as bundle/index share: one click toggles both
   'collapsed' (desktop: shrinks sidebar, content reflows) and 'open'
   (mobile: slides in as an overlay) — only the class that matches the
   current breakpoint's media query does anything, so no width
   detection is needed to pick the "right" behavior. */
const toggleBtn = document.getElementById('gnavToggle');
const shell = document.getElementById('guideShell');
const overlay = document.getElementById('gnavOverlay');
const closeBtn = document.getElementById('gnavCloseBtn');

function openDrawer(){
  shell.classList.add('open');
  overlay.classList.add('open');
  document.body.classList.add('gnav-open');
}
function closeDrawer(){
  shell.classList.remove('open');
  overlay.classList.remove('open');
  document.body.classList.remove('gnav-open');
}
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    shell.classList.contains('open') ? closeDrawer() : openDrawer();
  });
}
if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
if (overlay) overlay.addEventListener('click', closeDrawer);

document.getElementById('yr').textContent = new Date().getFullYear();
window.addEventListener('load', () => {
  document.querySelectorAll('.float-btn').forEach((btn, i) => {
    setTimeout(() => btn.classList.add('ready'), 400 + i * 80);
  });
});
refreshRevealObserver();
