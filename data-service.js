// ============ FIRESTORE DATA ACCESS ============
// One place that knows the `products`, `admins`, `auditLog`, and
// `pageviews` collection shapes. Public pages only ever read products
// and write pageviews; writes to products/guide/admins happen only
// from the admin panel, and every one of those is mirrored into
// `auditLog` so the dashboard can show who changed what.

const PRODUCTS_COLLECTION = 'products';

/* ---------------- PRODUCTS (public reads) ---------------- */

/* Firestore disallows nested arrays (arrays of arrays).
   Sanitize comparisonTable.rows: [ [...] ] into [ { cells: [...] } ] before saving,
   and unpack back on read so the rest of the application sees simple arrays. */
function sanitizeProductForFirestore(data){
  if (!data || typeof data !== 'object') return data;
  const clone = Object.assign({}, data);
  if (clone.comparisonTable && Array.isArray(clone.comparisonTable.rows)){
    clone.comparisonTable = Object.assign({}, clone.comparisonTable, {
      rows: clone.comparisonTable.rows.map(function(r){
        return Array.isArray(r) ? { cells: r } : r;
      })
    });
  }
  return clone;
}

function normalizeProductFromFirestore(data){
  if (!data || typeof data !== 'object') return data;
  if (data.comparisonTable && Array.isArray(data.comparisonTable.rows)){
    data.comparisonTable.rows = data.comparisonTable.rows.map(function(r){
      return (r && Array.isArray(r.cells)) ? r.cells : r;
    });
  }
  return data;
}

function fetchActiveProducts(){
  return db.collection(PRODUCTS_COLLECTION).where('active', '==', true).get()
    .then(function(snap){
      return snap.docs.map(function(d){ return normalizeProductFromFirestore(Object.assign({ id: d.id }, d.data())); });
    });
}

function fetchProduct(id){
  return db.collection(PRODUCTS_COLLECTION).doc(id).get().then(function(doc){
    return doc.exists ? normalizeProductFromFirestore(Object.assign({ id: doc.id }, doc.data())) : null;
  });
}

/* ---------------- PRODUCTS (admin) ---------------- */

function fetchAllProductsAdmin(){
  return db.collection(PRODUCTS_COLLECTION).get().then(function(snap){
    return snap.docs.map(function(d){ return normalizeProductFromFirestore(Object.assign({ id: d.id }, d.data())); });
  });
}

function saveProduct(id, data){
  const cleanData = sanitizeProductForFirestore(data);
  cleanData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  return db.collection(PRODUCTS_COLLECTION).doc(id).get().then(function(existing){
    const isNew = !existing.exists;
    return db.collection(PRODUCTS_COLLECTION).doc(id).set(cleanData, { merge: true }).then(function(){
      return logAudit(isNew ? 'create' : 'update', 'product', id, { name: cleanData.name });
    });
  });
}

function deleteProduct(id, name){
  return db.collection(PRODUCTS_COLLECTION).doc(id).delete().then(function(){
    return logAudit('delete', 'product', id, { name: name || id });
  });
}

function setProductActive(id, active){
  return db.collection(PRODUCTS_COLLECTION).doc(id).update({ active: active }).then(function(){
    return logAudit(active ? 'activate' : 'deactivate', 'product', id, {});
  });
}

function saveGuideSections(id, guideSections){
  return db.collection(PRODUCTS_COLLECTION).doc(id).set({
    guideSections: guideSections,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(function(){
    return logAudit('update-guide', 'product', id, { sections: guideSections.length });
  });
}

/* ---------------- AUDIT LOG ---------------- */
// Every product/guide write above calls this — never call it directly
// from a form; it's the single choke point that guarantees no CRUD
// action goes unlogged.
function logAudit(action, entity, entityId, extra){
  const user = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
  return db.collection('auditLog').add({
    action: action,
    entity: entity,
    entityId: entityId,
    adminEmail: user ? user.email : 'unknown',
    adminUid: user ? user.uid : null,
    extra: extra || {},
    at: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(err){ console.error('Audit log write failed', err); });
}

function fetchAuditLog(limit){
  return db.collection('auditLog').orderBy('at', 'desc').limit(limit || 100).get()
    .then(function(snap){ return snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); }); });
}

/* ---------------- ADMIN USER MANAGEMENT ---------------- */

function fetchAdmins(){
  return db.collection('admins').get().then(function(snap){
    return snap.docs.map(function(d){ return Object.assign({ uid: d.id }, d.data()); });
  });
}

function approveAdmin(uid, role){
  return db.collection('admins').doc(uid).update({ role: role || 'admin' }).then(function(){
    return logAudit('approve-admin', 'admin', uid, { role: role || 'admin' });
  });
}

function blockAdmin(uid){
  return db.collection('admins').doc(uid).update({ role: 'blocked' }).then(function(){
    return logAudit('block-admin', 'admin', uid, {});
  });
}

function unblockAdmin(uid, role){
  return db.collection('admins').doc(uid).update({ role: role || 'admin' }).then(function(){
    return logAudit('unblock-admin', 'admin', uid, { role: role || 'admin' });
  });
}

// Promote/demote an already-approved admin between 'admin' and 'subadmin'.
function setAdminRole(uid, role){
  return db.collection('admins').doc(uid).update({ role: role }).then(function(){
    return logAudit('set-admin-role', 'admin', uid, { role: role });
  });
}

// There is no client-side way to set another user's password directly —
// Firebase Auth only allows a user to change their OWN password (or
// reauthenticate as them, which needs their current password). Setting
// someone else's password outright requires the Admin SDK, i.e. a
// server or Cloud Function, which a static-HTML site doesn't have.
// Sending them a reset email is the real, secure equivalent: they get
// a link, set a new password themselves, no one else ever sees it.
function sendAdminPasswordReset(email){
  return auth.sendPasswordResetEmail(email).then(function(){
    return logAudit('send-password-reset', 'admin', email, {});
  });
}

// Removes the Firestore admin record only — the person can no longer
// pass requireAdmin() and log in. It does NOT delete their underlying
// Firebase Auth account; that requires the Admin SDK (a server/Cloud
// Function), which a static-HTML site doesn't have. Re-registering
// with the same email will fail ("email already in use") until that
// Auth account is removed from Firebase Console → Authentication → Users.
function removeAdminRecord(uid){
  return db.collection('admins').doc(uid).delete().then(function(){
    return logAudit('remove-admin-record', 'admin', uid, {});
  });
}

/* ---------------- ANALYTICS (pageviews) ---------------- */
// ============ USER AGENT PARSING ============
// Lightweight equivalent of the CASE WHEN browser/OS/device detection —
// no library needed for the handful of cases that actually matter here.
function parseUserAgent(ua){
  ua = ua || '';
  let browser = 'Unknown';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';

  let os = 'Unknown';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let device = 'Desktop';
  if (/Tablet|iPad/.test(ua)) device = 'Tablet';
  else if (/Mobi|Android.*Mobile|iPhone/.test(ua)) device = 'Mobile';

  return { browser: browser, os: os, device: device };
}

// Called automatically by firestore-loader.js on every public page.
// IP-based geo (city/region/country/lat/long/ISP, via a free no-key API)
// is always the baseline — the "nearest location" fallback. If the site
// owner has turned on "ask visitors for exact location" in
// admin/settings.html, this also asks the browser's Geolocation API for
// GPS-accurate coordinates first; that's a real permission prompt the
// visitor can allow or deny, and it's skipped entirely when the setting
// is off (the default). Either way, every pageview is logged — precise
// location only replaces the lat/lng, it's never required to log a visit.
function trackPageview(){
  const parsedUA = parseUserAgent(navigator.userAgent);
  const payload = {
    path: location.pathname.split('/').pop() || 'index.html',
    query: location.search || '',
    referrer: document.referrer || '',
    ua: navigator.userAgent,
    browser: parsedUA.browser,
    os: parsedUA.os,
    device: parsedUA.device,
    locationSource: 'ip',
    at: firebase.firestore.FieldValue.serverTimestamp()
  };

  function fillFromIp(){
    // Three providers now, tried in order — each one only runs if the
    // previous failed outright or came back success:false. ipwhois.app
    // (branded ipwhois.io — ipwhois.io itself is just their docs site,
    // the API is actually served from ipwhois.app) is tried first per
    // request. Its response shape is essentially identical to ipwho.is —
    // both nest ISP under connection.isp and both return a `success`
    // flag — so the same apply() handles both; ipapi.co's flatter shape
    // (isp info directly on `org`) is the one real difference, same as
    // before. If all three fail, the pageview still saves — just
    // without geo, same as always.
    //
    // Worth knowing: no free IP-geolocation provider is accurate 100% of
    // the time — this is inherent to how IP-based location works, not
    // something adding a provider fully fixes. Mobile-carrier IPs
    // especially often resolve to the carrier's NAT gateway city, not
    // the visitor's real one. For genuine accuracy, the GPS toggle in
    // admin/settings.html ("ask visitors for exact location") is the
    // real fix — this whole function is only ever the fallback for when
    // that's off or the visitor denies the prompt.
    function apply(geo, isp){
      payload.ip = geo.ip || payload.ip || null;
      payload.city = geo.city || payload.city || null;
      payload.region = geo.region || payload.region || null;
      payload.country = geo.country || geo.country_name || payload.country || 'Unknown';
      payload.countryCode = geo.country_code || payload.countryCode || '';
      payload.isp = isp || payload.isp || null;
      if (payload.lat == null && typeof geo.latitude === 'number') payload.lat = geo.latitude;
      if (payload.lng == null && typeof geo.longitude === 'number') payload.lng = geo.longitude;
    }

    function tryIpwhoIs(){
      return fetch('https://ipwho.is/').then(function(r){ return r.json(); })
        .then(function(geo){
          if (geo && geo.success !== false) { apply(geo, geo.connection && geo.connection.isp); return; }
          throw new Error('ipwho.is returned unsuccessful');
        })
        .catch(function(){
          return fetch('https://ipapi.co/json/').then(function(r){ return r.json(); })
            .then(function(geo){ apply(geo, geo.org); })
            .catch(function(){ /* all three failed — pageview still saves without geo */ });
        });
    }

    return fetch('https://ipwhois.app/json/').then(function(r){ return r.json(); })
      .then(function(geo){
        if (geo && geo.success !== false) { apply(geo, geo.connection && geo.connection.isp); return; }
        throw new Error('ipwhois.app returned unsuccessful');
      })
      .catch(function(){
        return tryIpwhoIs();
      });
  }

  function tryPreciseThenSave(){
    if (!navigator.geolocation){ return fillFromIp().then(save); }
    navigator.geolocation.getCurrentPosition(
      function(pos){
        payload.lat = pos.coords.latitude;
        payload.lng = pos.coords.longitude;
        payload.accuracyMeters = Math.round(pos.coords.accuracy);
        payload.locationSource = 'precise';
        // Still fetch IP info for city/country/ISP context, but never let
        // it overwrite the GPS coordinates we already have.
        fillFromIp().then(save);
      },
      function(){ fillFromIp().then(save); }, // denied/failed/timeout — fall back silently
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
    );
  }

  function save(){
    db.collection('pageviews').add(payload).catch(function(err){ console.error('Pageview tracking failed', err); });
  }

  fetchSiteSettings().then(function(s){
    if (s && s.exactGeoEnabled) tryPreciseThenSave();
    else fillFromIp().then(save);
  }).catch(function(){ fillFromIp().then(save); });
}

function fetchPageviews(limit){
  return db.collection('pageviews').orderBy('at', 'desc').limit(limit || 2000).get()
    .then(function(snap){ return snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); }); });
}

function deletePageview(id){
  return db.collection('pageviews').doc(id).delete();
}

/* ---------------- SITE SETTINGS ---------------- */
// One doc, `settings/site`, holds everything that used to be hardcoded
// across index.html/bundle.html/guide.html: site name, contact details,
// CV link, and a dynamic list of social links. site-settings.js applies
// it to every public page on load.
function fetchSiteSettings(){
  return db.collection('settings').doc('site').get().then(function(doc){
    return doc.exists ? doc.data() : null;
  });
}

function saveSiteSettings(data){
  data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  return db.collection('settings').doc('site').set(data, { merge: true }).then(function(){
    return logAudit('update', 'settings', 'site', {});
  });
}

/* ---------------- LAST LOGIN TRACKING ---------------- */
// Called from login.html right after a successful sign-in — writes the
// admin's last login time + best-effort geo onto their own admins doc.
function recordAdminLogin(uid){
  const payload = { lastLoginAt: firebase.firestore.FieldValue.serverTimestamp() };
  return fetch('https://ipwho.is/').then(function(r){ return r.json(); }).catch(function(){ return {}; })
    .then(function(geo){
      payload.lastLoginCity = geo.city || null;
      payload.lastLoginCountry = geo.country || null;
      payload.lastLoginIp = geo.ip || null;
      return db.collection('admins').doc(uid).set(payload, { merge: true });
    }).catch(function(err){ console.error('recordAdminLogin failed', err); });
}
