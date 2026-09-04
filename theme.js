// ============ THEME TOGGLE + MOBILE NAV ============
// Theme itself is set instantly by a tiny inline script in <head> (before
// paint, to avoid a flash of the wrong theme) — this file only wires up
// the toggle button's click behavior, plus the mobile hamburger dropdown.

document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.theme-toggle').forEach(function(btn){
    btn.addEventListener('click', function(){
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  });

  document.querySelectorAll('.tb-hamburger').forEach(function(btn){
    const links = btn.closest('.topbar-inner').querySelector('.tb-links');
    if (!links) return;

    function close(){ links.classList.remove('open'); }
    function toggle(e){ e.stopPropagation(); links.classList.toggle('open'); }

    btn.addEventListener('click', toggle);
    document.addEventListener('click', function(e){
      if (links.classList.contains('open') && !links.contains(e.target) && e.target !== btn) close();
    });
    links.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', close); });
  });
});
