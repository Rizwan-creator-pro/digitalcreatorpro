// ============================================================
// FIRESTORE LOADER
// Fetches every active product from Firestore, builds window.PRODUCTS
// and window.PRODUCTS_BY_ID in the exact same shape data.js used to hand-write,
// then loads the given scripts in order. If Firestore is empty or fails
// (e.g. offline, local file:// protocol, unseeded), automatically falls back
// to the static data.js so local folder files always work!
// ============================================================

function loadProducts(){
  return (typeof fetchActiveProducts === 'function' ? fetchActiveProducts() : Promise.reject(new Error('no fetchActiveProducts')))
    .then(function(list){
      if (list && list.length > 0) {
        window.PRODUCTS = list;
        window.PRODUCTS_BY_ID = {};
        list.forEach(function(p){ window.PRODUCTS_BY_ID[p.id] = p; });
        return;
      }
      return loadStaticData();
    })
    .catch(function(err){
      console.warn('Firestore load failed or empty, falling back to data.js:', err);
      return loadStaticData();
    });
}

function loadStaticData(){
  if (window.PRODUCTS && window.PRODUCTS.length > 0) {
    if (!window.PRODUCTS_BY_ID) {
      window.PRODUCTS_BY_ID = {};
      window.PRODUCTS.forEach(function(p){ window.PRODUCTS_BY_ID[p.id] = p; });
    }
    return Promise.resolve();
  }
  return new Promise(function(resolve){
    const s = document.createElement('script');
    s.src = (window.location.pathname.includes('/admin/') ? '../data.js' : 'data.js');
    s.onload = function(){
      if (window.PRODUCTS && !window.PRODUCTS_BY_ID) {
        window.PRODUCTS_BY_ID = {};
        window.PRODUCTS.forEach(function(p){ window.PRODUCTS_BY_ID[p.id] = p; });
      }
      resolve();
    };
    s.onerror = function(){
      console.error('Could not load data.js fallback');
      resolve(); // resolve anyway so execution continues
    };
    document.head.appendChild(s);
  });
}

function loadScriptsSequential(srcs){
  return srcs.reduce(function(chain, src){
    return chain.then(function(){
      return new Promise(function(resolve, reject){
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function(){ reject(new Error('Failed to load ' + src)); };
        document.body.appendChild(s);
      });
    });
  }, Promise.resolve());
}

// Track this page view (fire-and-forget — never blocks rendering).
if (typeof trackPageview === 'function') {
  try { trackPageview(); } catch(e){}
}
