// ============================================================
// SHARED RENDER LIBRARY
// Pure functions that turn PRODUCTS data (data.js) into HTML
// strings, plus a few delegated event handlers that work on
// content injected at any point after page load. No page-specific
// logic lives here — index.html / bundle.html / guide.html each
// call into this file, never the other way around.
// ============================================================

/* ---------- accent color ---------------------------------------------
   Sets the three --accent* custom properties on <html> so every rule
   already written against var(--accent-deep) etc. in style.css just
   picks up the right color — no per-product CSS file, ever.
   Pass null to reset to the site's default green (used for the combined
   bundle view, where no single product's identity should dominate). */
function hexToRgbValues(hex) {
  if (!hex || typeof hex !== 'string') return '29, 191, 115';
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return '29, 191, 115';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

function setAccent(product) {
  const root = document.documentElement.style;
  if (product) {
    root.setProperty('--accent', product.accent);
    root.setProperty('--accent-deep', product.accentDeep);
    root.setProperty('--accent-dim', product.accentDim);
    root.setProperty('--accent-rgb', hexToRgbValues(product.accent));
  } else {
    root.removeProperty('--accent');
    root.removeProperty('--accent-deep');
    root.removeProperty('--accent-dim');
    root.removeProperty('--accent-rgb');
  }
}

/* ---------- small building blocks -------------------------------- */

function renderStats(stats) {
  return stats.map(s =>
    `<div><div class="stat-number">${s.n}</div><div class="stat-label">${s.l}</div></div>`
  ).join('');
}

function renderTechChips(techStack) {
  const iconMap = {
    'JavaScript (ES6+)': 'fa-brands fa-js',
    'jQuery': 'fa-brands fa-square-js',
    'jsPDF': 'fa-solid fa-file-pdf',
    'jspdf-autotable': 'fa-solid fa-table',
    'SweetAlert2': 'fa-solid fa-bell',
    'Oracle APEX': 'fa-solid fa-database',
    'PL/SQL': 'fa-solid fa-code',
    'ORDS / REST': 'fa-solid fa-diagram-project',
    'HTML5': 'fa-brands fa-html5',
    'CSS3': 'fa-brands fa-css3-alt'
  };
  return techStack.map(t =>
    `<span class="tool-chip"><i class="${iconMap[t] || 'fa-solid fa-cube'}"></i>${t}</span>`
  ).join('');
}

/* ---------- code sections ------------------------------------------
   A product's codeSections array can be any length — one product might
   ship a single "steps + snippet" card, another might have five
   "Call Syntax" blocks plus a combined recap. This just loops over
   whatever's there; it never assumes a fixed count. */
function renderCodeSection(section, uid, idx) {
  if (section.kind === 'steps') {
    const stepsHtml = section.steps.map((s, i) => `
      <div class="qs-step reveal">
        <div class="qs-step-n">${i + 1}</div>
        <div>
          <div class="qs-step-t">${s.title}</div>
          <div class="qs-step-d">${s.desc}</div>
        </div>
      </div>`).join('');
    return `
      <div class="qs-card">
        <div class="qs-steps">${stepsHtml}</div>
        <div class="qs-code reveal"><pre>${section.codeHtml}</pre></div>
      </div>`;
  }

  // 'full' or 'inline' — a titled, copyable code block
  const codeId = `code_${uid}_${idx}`;
  const btnId  = `copy_${uid}_${idx}`;
  const header = section.title ? `
    <div class="qs-full-head">
      <div>
        <div class="qs-full-title">${section.title}</div>
        ${section.sub ? `<div class="qs-full-sub">${section.sub}</div>` : ''}
      </div>
      <button class="copy-btn" id="${btnId}" type="button" data-copy-target="${codeId}">
        <i class="fa-regular fa-copy"></i> <span>Copy Code</span>
      </button>
    </div>` : '';

  return `
    <div class="qs-full reveal" style="margin-top:1.4rem">
      ${header}
      <div class="qs-code qs-code-full"><pre id="${codeId}">${section.codeHtml}</pre></div>
    </div>`;
}

function renderAllCodeSections(product) {
  const meaningful = product.codeSections.filter(s =>
    (s.kind === 'steps' && s.steps && s.steps.length) || (s.kind !== 'steps' && s.codeHtml && s.codeHtml.trim())
  );
  return meaningful.map((s, i) => renderCodeSection(s, product.id, i)).join('\n');
}

/* ---------- guide sections -------------------------------------------
   Same principle: a product can have 4 guide groups or 6, each group
   can have 4 or 5 accordion items — the markup adapts to whatever
   length is actually in the data. */
function renderGuideGroup(group, product) {
  const itemsHtml = group.items.map((item, i) => `
    <div class="acc-item active">
      <div class="acc-item-head">
        <span class="acc-item-title">${item.title}<span class="acc-item-param">${item.param}</span></span>
      </div>
      <div class="acc-item-body">${item.body}</div>
    </div>`).join('');

  return `
    <div class="guide-block" id="${group.id}" data-product="${product.id}">
      <div class="section-label reveal">${group.label}</div>
      <h3 class="section-title reveal" style="font-size:clamp(1.5rem,3vw,2rem)">${group.title}</h3>
      ${group.sub ? `<p class="section-sub reveal">${group.sub}</p>` : ''}
      <div class="acc-feature reveal"><div class="acc-list">${itemsHtml}</div></div>
    </div>`;
}

function renderAllGuideGroups(product) {
  return product.guideSections.map(g => renderGuideGroup(g, product)).join('\n');
}

function getCtaIcon(text, href, fallback) {
  const t = (text || '').toLowerCase();
  const h = (href || '').toLowerCase();
  if (t.includes('email') || t.includes('mail') || h.startsWith('mailto:')) {
    return 'fa-solid fa-envelope';
  }
  if (t.includes('gumroad') || h.includes('gumroad.com')) {
    return 'fa-brands fa-gumroad';
  }
  if (t.includes('cart') || t.includes('buy') || t.includes('order')) {
    return 'fa-solid fa-cart-shopping';
  }
  return fallback || 'fa-solid fa-arrow-right';
}

/* ---------- pricing card ------------------------------------------ */
function renderPriceCard(card) {
  const cls = 'price-card' + (card.featured ? ' price-card-featured' : '') + ' reveal';
  const badgeCls = 'price-badge' + (card.featured ? ' featured' : '');
  const items = (card.items || []).map(t => `<li><i class="fa-solid fa-check"></i>${t}</li>`).join('');

  // Primary button (ctaHref / ctaText)
  const cta1Href = card.ctaHref || '';
  const cta1Text = card.ctaText || '';
  const cta1Icon = (card.ctaIcon && card.ctaIcon !== 'fa-solid' && card.ctaIcon !== 'fa-brands')
    ? card.ctaIcon
    : getCtaIcon(cta1Text, cta1Href, card.featured ? 'fa-solid fa-envelope' : 'fa-brands fa-gumroad');
  const target1 = cta1Href.startsWith('http') ? 'target="_blank" rel="noopener"' : '';

  // Secondary button (cta2Href / cta2Text - conditional)
  const cta2Href = card.cta2Href || '';
  const cta2Text = card.cta2Text || '';
  const cta2Icon = (card.cta2Icon && card.cta2Icon !== 'fa-solid' && card.cta2Icon !== 'fa-brands')
    ? card.cta2Icon
    : getCtaIcon(cta2Text, cta2Href, 'fa-solid fa-envelope');
  const target2 = cta2Href.startsWith('http') ? 'target="_blank" rel="noopener"' : '';

  const hasBtn1 = Boolean(cta1Text && cta1Href);
  const hasBtn2 = Boolean(cta2Text && cta2Href);

  let ctaHtml = '';
  if (hasBtn1 && hasBtn2) {
    // Both buttons: render side-by-side CTA group
    ctaHtml = `
      <div class="price-cta-group">
        <a href="${cta1Href}" class="btn-primary price-cta" ${target1}>
          <i class="${cta1Icon}"></i> <span>${cta1Text}</span>
        </a>
        <a href="${cta2Href}" class="btn-outline price-cta-sec" ${target2}>
          <i class="${cta2Icon}"></i> <span>${cta2Text}</span>
        </a>
      </div>`;
  } else if (hasBtn1) {
    // Single primary button
    ctaHtml = `
      <a href="${cta1Href}" class="btn-primary price-cta" ${target1}>
        <i class="${cta1Icon}"></i> <span>${cta1Text}</span>
      </a>`;
  } else if (hasBtn2) {
    // Single secondary button
    ctaHtml = `
      <a href="${cta2Href}" class="btn-primary price-cta" ${target2}>
        <i class="${cta2Icon}"></i> <span>${cta2Text}</span>
      </a>`;
  }

  return `
    <div class="${cls}">
      <div class="${badgeCls}">${card.badge}</div>
      <div class="price-amount">${card.amountHtml}</div>
      <div class="price-desc">${card.descHtml}</div>
      <ul class="price-list">${items}</ul>
      ${ctaHtml}
    </div>`;
}

function renderPricing(product) {
  return `<div class="price-grid">${product.pricing.map(renderPriceCard).join('')}</div>`;
}

/* ---------- comparison table -----------------------------------------
   Fully data-driven — any number of columns, any number of rows, no
   fixed shape assumed anywhere. product.comparisonTable is optional;
   returning '' here (rather than some empty-table markup) is what lets
   the caller hide the whole section when nothing's configured, instead
   of showing an empty box.
   Every cell (not just some special-cased column) runs through
   renderComparisonCell — a cell whose trimmed value is exactly
   yes/no/true/false/✓/✗ renders as a check/cross icon; anything else
   (a row label, "Limited", "$19 one-time", whatever) renders as plain
   text. Nothing about column position is treated differently. */
function renderComparisonCell(value) {
  const v = (value || '').toString().trim().toLowerCase();
  if (v === 'yes' || v === 'true' || v === '✓' || v === 'y') return '<i class="fa-solid fa-check comp-yes"></i>';
  if (v === 'no' || v === 'false' || v === '✗' || v === 'n') return '<i class="fa-solid fa-xmark comp-no"></i>';
  return (value === undefined || value === null || value === '') ? '—' : value;
}

function renderComparisonTable(product) {
  const ct = product.comparisonTable;
  if (!ct || !ct.columns || !ct.columns.length || !ct.rows || !ct.rows.length) return '';

  const highlightIdx = (typeof ct.highlightColumn === 'number') ? ct.highlightColumn : -1;

  const headHtml = ct.columns.map((col, i) =>
    `<th${i === highlightIdx ? ' class="comp-highlight"' : ''}>${col || ''}</th>`
  ).join('');

  const rowsHtml = ct.rows.map(row => {
    const cells = (row && Array.isArray(row.cells)) ? row.cells : (Array.isArray(row) ? row : []);
    const cellsHtml = cells.map((cell, i) =>
      `<td${i === highlightIdx ? ' class="comp-highlight"' : ''}>${renderComparisonCell(cell)}</td>`
    ).join('');
    return `<tr>${cellsHtml}</tr>`;
  }).join('');

  return `
    <div class="section-label reveal">${ct.label || 'Why Use It'}</div>
    <h2 class="section-title reveal">${ct.title || 'How It Compares'}</h2>
    ${ct.sub ? `<p class="section-sub reveal">${ct.sub}</p>` : ''}
    <div class="comp-table-wrap reveal">
      <table class="comp-table">
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

/* ---------- product card (index.html) ------------------------------ */
function renderProductCard(product) {
  const cleanLede = (product.lede || '').replace(/<[^>]+>/g, '');
  const searchBlob = [
    product.name, cleanLede, product.eyebrow,
    (product.techStack || []).join(' '),
    (product.guideSections || []).map(g => g.title).join(' ')
  ].join(' ').toLowerCase();

  const mainStat = product.stats[0];
  const price = product.pricing && product.pricing[0] ? product.pricing[0].amountHtml.match(/\$\d+/)?.[0] : '';

  return `
    <div class="product-card" data-search="${searchBlob.replace(/"/g, '&quot;')}">
      <a href="bundle.html?product=${product.id}" class="pc-media">
        <img src="${product.boxImage}" alt="${product.name}" loading="lazy" onerror="this.src='https://i.ibb.co/JfbkpdN/Thumbnail.png'">
      </a>
      <div class="pc-body">
        <div class="pc-eyebrow">${product.eyebrow}</div>
        <h3 class="pc-title"><a href="bundle.html?product=${product.id}">${product.name}</a></h3>
        <p class="pc-desc">${product.lede}</p>
        <div class="pc-meta">
          <span class="pc-stat">${mainStat.n} ${mainStat.l}</span>
          <span class="pc-price">From ${price}</span>
        </div>
        <a href="bundle.html?product=${product.id}" class="btn-primary pc-cta">View Product <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </div>`;
}

/* ---------- delegated events ----------------------------------------
   Everything above injects HTML after the initial page load, so
   listeners are attached to a static ancestor (document.body) instead
   of to individual elements — this way newly-rendered accordions and
   copy buttons work immediately with no re-wiring step required. */
document.addEventListener('click', (e) => {
  const accItem = e.target.closest('.acc-item');
  if (accItem && !accItem.closest('.guide-main') && accItem.tagName !== 'DIV') {
    accItem.classList.toggle('active');
    return;
  }

  const copyBtn = e.target.closest('.copy-btn[data-copy-target]');
  if (copyBtn) {
    const pre = document.getElementById(copyBtn.dataset.copyTarget);
    if (!pre) return;
    navigator.clipboard.writeText(pre.innerText).then(() => {
      const label = copyBtn.querySelector('span');
      const original = label.textContent;
      copyBtn.classList.add('copied');
      label.textContent = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); label.textContent = original; }, 1800);
    });
  }
});

/* ---------- scroll reveal --------------------------------------------
   Re-runnable: call refreshRevealObserver() any time new .reveal
   elements are injected (e.g. after switching guide tabs), since the
   original IntersectionObserver only saw elements present at the time
   it was created. */
let _revealObs = null;
function refreshRevealObserver() {
  if (!_revealObs) {
    _revealObs = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('visible'); _revealObs.unobserve(en.target); }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
  }
  document.querySelectorAll('.reveal:not(.visible)').forEach((el, i) => {
    if (!el.dataset.revealBound) {
      el.style.transitionDelay = (i % 5) * 0.05 + 's';
      el.dataset.revealBound = '1';
    }
    _revealObs.observe(el);
    // Safety net: the IntersectionObserver can occasionally never fire for
    // a given element (fast navigation, elements injected in an unusual
    // scroll position, some screenshot/automation tools) — when that
    // happens the element is stuck at opacity:0 forever, which looks like
    // an empty/glitched section even though its content is really there.
    // Force it visible after a short delay regardless, so nothing can stay
    // permanently hidden — this never fires early for anything the
    // observer already caught, since .visible is checked first.
    setTimeout(() => {
      if (!el.classList.contains('visible')) el.classList.add('visible');
    }, 1200);
  });
}
