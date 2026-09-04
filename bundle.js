// ============================================================
// BUNDLE PAGE CONTROLLER
// Always renders exactly one product's detail page — hero, code
// sections, pricing (however many price cards that product has: one,
// two, whatever). No combined "bundle of everything" view. If a
// product needs to look like a bundle (multiple tools, multiple price
// tiers), just create it as a normal product through the admin panel
// with its own pricing array — that's already fully supported, no
// special mode needed.
// Everything below reads PRODUCTS from data.js — there is no
// per-product HTML anywhere in this file or bundle.html.
// ============================================================

// Both declared up front, not near the functions that use them —
// renderSingleProduct() runs immediately below, synchronously calling
// renderHeroMedia() and renderDemoMedia() before the script reaches any
// `let` declared later in the file. A `let` is in the temporal dead zone
// until its own line executes, so referencing (or assigning to) it from
// that earlier call throws "Cannot access '<name>' before initialization"
// and aborts the entire script — which is why the page rendered blank
// both times this happened. ANY new top-level `let`/`const` used inside
// a function that renderSingleProduct calls must be declared here, not
// near its function.
//
// Naming note: _demoMediaProduct was originally called _heroMediaProduct
// despite only ever tracking the DEMO section's current product (for the
// lightbox) — the hero box had no configurable media of its own at all
// until renderHeroMedia() below was added, so that name was always wrong.
// Renamed here rather than left to rot further now that a real, separate
// hero media system exists alongside it.
let _slideshowTimer = null;      // demo section's slideshow interval
let _heroSlideTimer = null;      // hero box's slideshow interval — separate
                                  // from _slideshowTimer so a product with
                                  // BOTH hero and demo set to slideshow runs
                                  // two independent rotations, not one
                                  // clobbering the other.
let _demoMediaProduct = null;    // demo section's active product, read by
                                  // the lightbox at click time

const params = new URLSearchParams(location.search);
const requestedId = params.get('product');
const activeProduct = (requestedId && window.PRODUCTS_BY_ID && window.PRODUCTS_BY_ID[requestedId]) ? window.PRODUCTS_BY_ID[requestedId] : (window.PRODUCTS && window.PRODUCTS[0]);

if (activeProduct) {
  renderSingleProduct(activeProduct);
} else {
  document.getElementById('productContent').innerHTML = '<p class="section-sub">No products found.</p>';
}

document.getElementById('yr').textContent = new Date().getFullYear();
window.addEventListener('load', () => {
  document.querySelectorAll('.float-btn').forEach((btn, i) => {
    setTimeout(() => btn.classList.add('ready'), 400 + i * 80);
  });
});
refreshRevealObserver();

/* ====================================================================
   SINGLE-PRODUCT MODE — the only mode
   ==================================================================== */
function renderSingleProduct(product) {
  setAccent(product);

  document.getElementById('pageTitle').textContent = `${product.name} | Digital Creator`;
  document.getElementById('pageDesc').setAttribute('content', (product.lede || '').replace(/<[^>]+>/g, ''));
  document.getElementById('tbSuffix').textContent = `— ${product.name}`;

  document.getElementById('heroEyebrow').textContent = product.eyebrow;
  document.getElementById('heroTitle').innerHTML = product.titleHtml;
  document.getElementById('heroLede').innerHTML = product.lede || '';
  document.getElementById('heroStats').innerHTML = renderStats(product.stats);
  document.getElementById('heroTag').innerHTML = product.heroTag;
  renderHeroMedia(product);
  renderDemoMedia(product);
  document.getElementById('ctaBuyLabel').textContent = `Buy ${product.name}`;

  const guideHref = `guide.html?product=${product.id}`;
  document.getElementById('tbGuideLink').href = guideHref;
  document.getElementById('ctaGuideLink').href = guideHref;
  document.getElementById('calloutGuideLink').href = guideHref;
  document.getElementById('footerGuideLink').href = guideHref;

  document.getElementById('productContent').innerHTML = `
    <div class="product-quickstart-head">
      ${renderAllCodeSections(product)}
    </div>`;

  // Empty string from renderComparisonTable() means this product has no
  // comparisonTable configured — hide the section entirely rather than
  // showing an empty box. This is the "conditional" behavior: it's
  // per-product, driven purely by whether that product's data has it.
  const comparisonHtml = renderComparisonTable(product);
  document.getElementById('comparisonContent').innerHTML = comparisonHtml;
  document.getElementById('comparisonSection').style.display = comparisonHtml ? '' : 'none';

  // renderPricing() already loops product.pricing — one card, two, however
  // many exist for this product. Nothing special needed for a "bundle"-like
  // product beyond giving it more than one pricing card in the admin form.
  document.getElementById('pricing').innerHTML = `
    <div class="section-label reveal">Get It</div>
    <h2 class="section-title reveal">Pricing</h2>
    <p class="section-sub reveal">Buy the file outright and wire it in yourself, or have it installed and configured against your actual report.</p>
    ${renderPricing(product)}`;

  document.getElementById('techHeading').textContent = 'What Powers It';
  document.getElementById('techChips').innerHTML = renderTechChips(product.techStack);
  // Footer tagline is intentionally left alone here — it's the same
  // site-wide text on every page, applied once by site-settings.js.
}

/* ====================================================================
   VIDEO EMBED — turns whatever URL an admin pastes into the right
   playable element. A bare <video src="..."> only works for a direct
   file link (.mp4/.webm/etc) — pasting a normal YouTube or Vimeo page
   URL into that produces nothing (the browser can't play an HTML page
   as a video stream). This detects YouTube/Vimeo links specifically
   and builds the matching iframe embed instead; anything else is
   assumed to be a direct file link and gets a plain <video>, exactly
   as before. Shared by renderHeroMedia, renderDemoMedia, and the
   lightbox, so "paste any video URL" behaves identically everywhere.
   ==================================================================== */
function getYouTubeId(url) {
  // Parsed via URL()/searchParams rather than a literal-string regex —
  // the old regex required "watch?v=" as an exact substring, which only
  // matches when v is the FIRST query parameter. Real-world YouTube
  // links (from playlists, tracking params like &si=, share-sheet
  // variants) often don't have v first, so pasted links that looked
  // completely normal were silently failing to embed. This also picks
  // up /shorts/, /embed/, /live/, and m.youtube.com, none of which the
  // old regex covered.
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return (id && id.length === 11) ? id : null;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.has('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch (e) {
    // Malformed / relative / protocol-less URL — URL() throws instead of
    // parsing it. Fall through to a looser regex rather than giving up.
  }
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url) {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function getGoogleDriveId(url) {
  // Handles both link shapes Drive's own "Share" dialog produces:
  // /file/d/FILE_ID/view and the older ?id=FILE_ID form.
  let m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/drive\.google\.com|docs\.google\.com/.test(url)) {
    m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
  }
  return null;
}

function renderVideoEmbed(url, opts) {
  opts = opts || {};
  const autoplay = opts.autoplay !== false;
  const muted = opts.muted !== false;
  const loop = opts.loop !== false;
  const controls = !!opts.controls;

  const ytId = getYouTubeId(url);
  if (ytId) {
    const p = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      mute: muted ? '1' : '0',
      controls: controls ? '1' : '0',
      loop: loop ? '1' : '0',
      // YouTube only loops a SINGLE video if playlist is set to that
      // same video's own ID — a quirk of their embed API, not a typo.
      playlist: loop ? ytId : '',
      rel: '0',
      modestbranding: '1'
    });
    return `<iframe src="https://www.youtube-nocookie.com/embed/${ytId}?${p.toString()}" title="Video" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  }

  const vimeoId = getVimeoId(url);
  if (vimeoId) {
    const p = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      muted: muted ? '1' : '0',
      loop: loop ? '1' : '0',
      controls: controls ? '1' : '0'
    });
    return `<iframe src="https://player.vimeo.com/video/${vimeoId}?${p.toString()}" title="Video" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  }

  const driveId = getGoogleDriveId(url);
  if (driveId) {
    // Drive's preview iframe does not honor autoplay/mute/loop params at
    // all — that's a Google limitation, not something fixable from here.
    // It embeds and is playable (viewer clicks Drive's own play button),
    // it just never autoplays like a direct file or YouTube/Vimeo would.
    return `<iframe src="https://drive.google.com/file/d/${driveId}/preview" title="Video" frameborder="0" allow="autoplay" allowfullscreen></iframe>`;
  }

  // Not YouTube/Vimeo/Drive — assume a direct file URL, same as before.
  return `<video src="${url}"${autoplay ? ' autoplay' : ''}${muted ? ' muted' : ''}${loop ? ' loop' : ''} playsinline${controls ? ' controls' : ''}></video>`;
}

/* ====================================================================
   HERO MEDIA — image (default), gif, video, or an auto-rotating
   slideshow, chosen per product via product.heroMediaType. Renders into
   the box in the top-right of the hero, next to the title. Independent
   from DEMO MEDIA below — a product can show a plain static box photo
   here while running an animated walkthrough in the "Watch It Run"
   section, or vice versa, or the same asset in both if that's simpler
   for a given product. This function was stubbed out as a comment with
   no body for a while (product.mediaType/videoUrl/slideshowImages only
   ever drove the demo section, never this one, despite the admin form
   label saying "Hero Media Type") — this is the real implementation.
   ==================================================================== */
function renderHeroMedia(product) {
  if (_heroSlideTimer) { clearInterval(_heroSlideTimer); _heroSlideTimer = null; }
  const el = document.getElementById('heroMediaContent');
  const type = product.heroMediaType || 'image';

  if (type === 'video' && product.heroVideoUrl) {
    el.innerHTML = renderVideoEmbed(product.heroVideoUrl, { autoplay: true, muted: true, loop: true, controls: false });
    return;
  }

  if (type === 'slideshow' && product.heroSlideshowImages && product.heroSlideshowImages.length) {
    const imgs = product.heroSlideshowImages;
    el.innerHTML =
      imgs.map((src, i) => `<img class="demo-slide${i === 0 ? ' active' : ''}" src="${src}" alt="${product.name} ${i + 1}">`).join('') +
      (imgs.length > 1 ? `
        <button type="button" class="demo-slide-nav prev" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button>
        <button type="button" class="demo-slide-nav next" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>
        <div class="demo-slide-dots">${imgs.map((_, i) => `<span class="demo-slide-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>` : '');

    let idx = 0;
    const slides = el.querySelectorAll('.demo-slide');
    const dots = el.querySelectorAll('.demo-slide-dot');

    function showHeroSlide(newIdx) {
      slides[idx].classList.remove('active');
      if (dots[idx]) dots[idx].classList.remove('active');
      idx = (newIdx + slides.length) % slides.length;
      slides[idx].classList.add('active');
      if (dots[idx]) dots[idx].classList.add('active');
    }

    function restartHeroTimer() {
      if (_heroSlideTimer) clearInterval(_heroSlideTimer);
      _heroSlideTimer = setInterval(() => showHeroSlide(idx + 1), 3200);
    }

    if (slides.length > 1) {
      el.querySelector('.demo-slide-nav.prev').addEventListener('click', (e) => { e.stopPropagation(); showHeroSlide(idx - 1); restartHeroTimer(); });
      el.querySelector('.demo-slide-nav.next').addEventListener('click', (e) => { e.stopPropagation(); showHeroSlide(idx + 1); restartHeroTimer(); });
      restartHeroTimer();
    }
    return;
  }

  // Default — a single static image (or animated .gif, browsers animate
  // those natively in a plain <img>), same as the box always showed
  // before this function existed. This never leaves the hero blank the
  // way an unconfigured demo section is allowed to (see DEMO MEDIA
  // below) — every product needs SOME box image, so there's no
  // "hide if unconfigured" branch here.
  el.innerHTML = `<img src="${product.boxImage}" alt="${product.name}" loading="lazy" onerror="this.src='https://i.ibb.co/JfbkpdN/Thumbnail.png'">`;
}

/* ====================================================================
   DEMO MEDIA — image (default), gif, video, or an auto-rotating
   slideshow, chosen per product via product.demoMediaType. Renders into
   the laptop mockup in the "Watch It Run" section, which sits after the
   code sections. Independent from HERO MEDIA above.
   Falls back to the legacy product.mediaType field (read-only, never
   written anymore) for product docs saved before demoMediaType existed —
   that field always drove this section despite once being admin-labeled
   "Hero Media Type", so this keeps old data working with no re-save
   required. Hides the whole section if nothing is configured either way.
   ==================================================================== */

function renderDemoMedia(product) {
  _demoMediaProduct = product;
  if (_slideshowTimer) { clearInterval(_slideshowTimer); _slideshowTimer = null; }
  const section = document.getElementById('demoSection');
  const el = document.getElementById('demoMediaContent');
  const type = product.demoMediaType || product.mediaType || 'image';

  if (type === 'video' && product.videoUrl) {
    section.style.display = '';
    document.getElementById('demoHeading').textContent = 'Watch It Run';
    document.getElementById('demoSub').textContent = 'Click the screen for a closer look.';
    el.innerHTML = renderVideoEmbed(product.videoUrl, { autoplay: true, muted: true, loop: true, controls: false });
    return;
  }

  if (type === 'slideshow' && product.slideshowImages && product.slideshowImages.length) {
    section.style.display = '';
    document.getElementById('demoHeading').textContent = 'See It In Action';
    document.getElementById('demoSub').textContent = 'Click the screen for a closer look.';
    const imgs = product.slideshowImages;
    el.innerHTML =
      imgs.map((src, i) => `<img class="demo-slide${i === 0 ? ' active' : ''}" src="${src}" alt="${product.name} screenshot ${i + 1}">`).join('') +
      (imgs.length > 1 ? `
        <button type="button" class="demo-slide-nav prev" aria-label="Previous screenshot"><i class="fa-solid fa-chevron-left"></i></button>
        <button type="button" class="demo-slide-nav next" aria-label="Next screenshot"><i class="fa-solid fa-chevron-right"></i></button>
        <div class="demo-slide-dots">${imgs.map((_, i) => `<span class="demo-slide-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>` : '');

    let idx = 0;
    const slides = el.querySelectorAll('.demo-slide');
    const dots = el.querySelectorAll('.demo-slide-dot');

    function showDemoSlide(newIdx) {
      slides[idx].classList.remove('active');
      if (dots[idx]) dots[idx].classList.remove('active');
      idx = (newIdx + slides.length) % slides.length;
      slides[idx].classList.add('active');
      if (dots[idx]) dots[idx].classList.add('active');
    }

    function restartDemoTimer() {
      if (_slideshowTimer) clearInterval(_slideshowTimer);
      _slideshowTimer = setInterval(() => showDemoSlide(idx + 1), 3200);
    }

    if (slides.length > 1) {
      // stopPropagation matters here — #demoMedia has its own click
      // handler that opens the fullscreen lightbox; without this,
      // clicking an arrow would also trigger that.
      el.querySelector('.demo-slide-nav.prev').addEventListener('click', (e) => { e.stopPropagation(); showDemoSlide(idx - 1); restartDemoTimer(); });
      el.querySelector('.demo-slide-nav.next').addEventListener('click', (e) => { e.stopPropagation(); showDemoSlide(idx + 1); restartDemoTimer(); });
      restartDemoTimer();
    }
    return;
  }

  // demoImage is a field of its own, independent from the hero's boxImage —
  // a product can show a plain static box render in the hero and a
  // separate animated GIF (or any other image) down here. Older product
  // docs saved before this field existed never set demoImage, so as a
  // one-time fallback (never for new saves — product-form.html always
  // writes demoImage explicitly, even as '') we reuse boxImage when IT
  // happens to be a gif, matching the old behavior exactly.
  const demoImg = product.demoImage || (product.boxImage && /\.gif(\?|$)/i.test(product.boxImage) ? product.boxImage : '');
  if (type === 'image' && demoImg) {
    section.style.display = '';
    document.getElementById('demoHeading').textContent = 'Watch It Run';
    document.getElementById('demoSub').textContent = 'Click the screen for a closer look.';
    el.innerHTML = `<img src="${demoImg}" alt="${product.name}" loading="lazy">`;
    return;
  }

  // No video/slideshow/demo image configured for this product — nothing
  // extra to demo beyond the hero image, so skip the section entirely.
  section.style.display = 'none';
}

/* ---------------------------------------------------------------------
   FULLSCREEN LIGHTBOX — clicking the laptop screen opens whatever's
   currently showing (video, or the slideshow's active frame, or the
   gif) at full size. Wired once; renderDemoMedia only needs to update
   _demoMediaProduct, this reads that at click time so it always shows
   the current product's media even after switching pages.
   --------------------------------------------------------------------- */
(function initLightbox(){
  const demoMedia = document.getElementById('demoMedia');
  const lightbox = document.getElementById('mediaLightbox');
  const content = document.getElementById('mediaLightboxContent');
  const closeBtn = document.getElementById('mediaLightboxClose');
  if (!demoMedia || !lightbox) return;

  function open() {
    if (!_demoMediaProduct) return;
    const type = _demoMediaProduct.demoMediaType || _demoMediaProduct.mediaType || 'image';
    let mediaHtml;
    let lightboxSlides = null; // set only for slideshow — used below to wire nav buttons after insertion

    if (type === 'video' && _demoMediaProduct.videoUrl) {
      mediaHtml = renderVideoEmbed(_demoMediaProduct.videoUrl, { autoplay: true, muted: false, loop: false, controls: true });
    } else if (type === 'slideshow' && _demoMediaProduct.slideshowImages && _demoMediaProduct.slideshowImages.length) {
      lightboxSlides = _demoMediaProduct.slideshowImages;
      const activeImg = document.querySelector('#demoMediaContent .demo-slide.active');
      let startIdx = 0;
      if (activeImg) {
        const allSlides = Array.from(document.querySelectorAll('#demoMediaContent .demo-slide'));
        const found = allSlides.indexOf(activeImg);
        if (found >= 0) startIdx = found;
      }
      content.dataset.slideIdx = startIdx;
      mediaHtml = `<img id="lightboxSlideImg" src="${lightboxSlides[startIdx]}" alt="${_demoMediaProduct.name}">` +
        (lightboxSlides.length > 1 ? `
          <button type="button" class="demo-slide-nav prev" id="lightboxSlidePrev" aria-label="Previous"><i class="fa-solid fa-chevron-left"></i></button>
          <button type="button" class="demo-slide-nav next" id="lightboxSlideNext" aria-label="Next"><i class="fa-solid fa-chevron-right"></i></button>` : '');
    } else {
      // Same fallback as renderDemoMedia(): the lightbox only opens while
      // #demoMedia is visible, which only happens once that function has
      // already resolved a non-empty image — this just re-derives the
      // same value rather than reading it back off the DOM.
      const demoImg = _demoMediaProduct.demoImage ||
        (_demoMediaProduct.boxImage && /\.gif(\?|$)/i.test(_demoMediaProduct.boxImage) ? _demoMediaProduct.boxImage : '');
      mediaHtml = `<img src="${demoImg}" alt="${_demoMediaProduct.name}">`;
    }
    content.innerHTML = `<button class="media-lightbox-close" id="mediaLightboxClose" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>` + mediaHtml;
    content.querySelector('.media-lightbox-close').addEventListener('click', close);

    if (lightboxSlides && lightboxSlides.length > 1) {
      const imgEl = content.querySelector('#lightboxSlideImg');
      const goToSlide = (delta) => {
        let i = Number(content.dataset.slideIdx) || 0;
        i = (i + delta + lightboxSlides.length) % lightboxSlides.length;
        content.dataset.slideIdx = i;
        imgEl.src = lightboxSlides[i];
      };
      content.querySelector('#lightboxSlidePrev').addEventListener('click', (e) => { e.stopPropagation(); goToSlide(-1); });
      content.querySelector('#lightboxSlideNext').addEventListener('click', (e) => { e.stopPropagation(); goToSlide(1); });
    }

    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    content.querySelectorAll('video').forEach(v => v.pause());
    // .pause() only stops native <video> — a YouTube/Vimeo <iframe> is a
    // separate origin and can't be controlled from here at all. Clearing
    // the container detaches it entirely, which does stop playback, and
    // is safe either way since open() always rebuilds this HTML fresh.
    content.innerHTML = '';
  }

  demoMedia.addEventListener('click', open);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
  if (closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowLeft') { const b = content.querySelector('#lightboxSlidePrev'); if (b) b.click(); }
    if (e.key === 'ArrowRight') { const b = content.querySelector('#lightboxSlideNext'); if (b) b.click(); }
  });
})();
