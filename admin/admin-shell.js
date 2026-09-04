// ============ ADMIN SHELL — RESPONSIVE SIDEBAR ============
// Included on every admin page. The hamburger button and overlay only
// render/act on screens narrow enough per the CSS (see .hamburger-btn
// media query in style.css) — on desktop this is inert.
(function(){
  const btn = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('adminOverlay');
  if (!btn || !sidebar || !overlay) return;

  function open(){ sidebar.classList.add('open'); overlay.classList.add('open'); }
  function close(){ sidebar.classList.remove('open'); overlay.classList.remove('open'); }

  btn.addEventListener('click', function(){
    sidebar.classList.contains('open') ? close() : open();
  });
  overlay.addEventListener('click', close);
  sidebar.querySelectorAll('a, button').forEach(function(el){ el.addEventListener('click', close); });
})();

// Called from each page's requireAdmin(function(user, adminDoc){ ... })
// callback — removes the Site Settings / Audit Log / Seed Data links for
// anyone who isn't a full admin, so sub-admins never see links to pages
// they'd just get redirected out of.
function hideFullAdminLinksIfNeeded(role){
  if (role === 'admin') return;
  ['settingsNavLink', 'auditNavLink', 'seedNavLink'].forEach(function(id){
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}
