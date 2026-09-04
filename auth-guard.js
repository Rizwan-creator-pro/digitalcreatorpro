// ============ ADMIN ROUTE GUARD ============
// Include after firebase-config.js on every page under /admin/.
//
// Two tiers: 'admin' (full access) and 'subadmin' (day-to-day content
// work — products and guides — but not settings, other admins, the
// audit log, or the seed tool). requireAdmin() lets either in.
// requireFullAdmin() is for pages/actions that must stay admin-only —
// it calls requireAdmin() first, then blocks subadmins with a message
// and a redirect back to the dashboard.
//
// This is a UX convenience only; the real enforcement lives in
// Firestore Security Rules — this check alone does not stop someone
// from calling Firestore directly.
function requireAdmin(onReady){
  auth.onAuthStateChanged(function(user){
    if (!user){
      location.href = pathToRoot() + 'login.html';
      return;
    }
    db.collection('admins').doc(user.uid).get().then(function(doc){
      const role = doc.exists ? doc.data().role : null;
      if (!doc.exists || (role !== 'admin' && role !== 'subadmin')){
        auth.signOut();
        alert('Your account is not an approved admin yet.');
        location.href = pathToRoot() + 'login.html';
        return;
      }
      try {
        onReady(user, doc.data());
      } catch (err) {
        // A bug in the page's own callback must never look like an auth
        // failure — that used to fall into the .catch() below and bounce
        // the person back to login (which, if already signed in, just
        // redirects straight back to the dashboard) with no clue why.
        console.error('Error in requireAdmin callback — this is a page bug, not an auth problem:', err);
      }
    }).catch(function(err){
      console.error(err);
      location.href = pathToRoot() + 'login.html';
    });
  });
}

function requireFullAdmin(onReady){
  requireAdmin(function(user, adminDoc){
    if (adminDoc.role !== 'admin'){
      alert('This page is only available to full admins, not sub-admins.');
      location.href = 'dashboard.html';
      return;
    }
    onReady(user, adminDoc);
  });
}

function pathToRoot(){
  const p = (location.pathname || '').toLowerCase().replace(/\\/g, '/');
  return p.includes('/admin/') ? '../' : '';
}

function adminLogout(){
  auth.signOut().then(function(){ location.href = pathToRoot() + 'login.html'; });
}
