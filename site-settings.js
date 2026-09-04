// ============ SITE SETTINGS LOADER ============
// Include after data-service.js on any public page. Call
// loadSiteSettings() once Firestore is ready — it finds every contact
// touchpoint on the page by pattern (mailto:, tel:, wa.me, cv.pdf) and
// updates them, then swaps the hardcoded LinkedIn-only link for the
// full dynamic social list once one has been configured in
// admin/settings.html.

function loadSiteSettings(){
  return fetchSiteSettings().then(applySiteSettings).catch(function(err){
    console.error('Could not load site settings, keeping page defaults', err);
  });
}

function applySiteSettings(s){
  if (!s) return; // no settings doc yet — page keeps its hardcoded defaults

  if (s.siteMark){
    document.querySelectorAll('.tb-mark-text').forEach(function(el){ el.textContent = s.siteMark; });
  }

  if (s.cvUrl){
    document.querySelectorAll('a[href="cv.pdf"]').forEach(function(a){ a.setAttribute('href', s.cvUrl); });
  }

  if (s.email){
    document.querySelectorAll('a[href^="mailto:"]').forEach(function(a){
      const oldEmail = a.getAttribute('href').replace('mailto:', '').split('?')[0];
      const rest = a.getAttribute('href').slice(('mailto:' + oldEmail).length);
      a.setAttribute('href', 'mailto:' + s.email + rest);
      if (a.textContent.trim() === oldEmail) a.textContent = s.email;
    });
  }

  if (s.phoneDigits){
    document.querySelectorAll('a[href^="tel:"]').forEach(function(a){
      a.setAttribute('href', 'tel:+' + s.phoneDigits);
      if (s.phoneDisplay && /^\+?[\d\s]+$/.test(a.textContent.trim())) a.textContent = s.phoneDisplay;
    });
    document.querySelectorAll('.float-btn.ph .float-tooltip').forEach(function(t){
      if (s.phoneDisplay) t.textContent = s.phoneDisplay;
    });
  }

  if (s.whatsappDigits){
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(function(a){
      a.setAttribute('href', 'https://wa.me/' + s.whatsappDigits);
    });
  }

  if (s.ownerName){
    document.querySelectorAll('.footer-owner-name').forEach(function(el){ el.textContent = s.ownerName; });
  }

  if (s.footerTagline){
    document.querySelectorAll('.footer-tag').forEach(function(el){ el.textContent = s.footerTagline; });
  }

  if (s.navLinks && s.navLinks.length){
    document.querySelectorAll('.tb-links').forEach(function(wrap){
      const anchor = wrap.querySelector('.theme-toggle') || wrap.querySelector('.tb-cv');
      s.navLinks.forEach(function(nav){
        const a = document.createElement('a');
        a.href = nav.url; a.className = 'tb-more';
        a.textContent = nav.label;
        wrap.insertBefore(a, anchor || null);
      });
    });
  }

  if (s.socialLinks && s.socialLinks.length){
    document.querySelectorAll('.js-default-social').forEach(function(el){ el.remove(); });

    document.querySelectorAll('.tb-links').forEach(function(wrap){
      const anchor = wrap.querySelector('.tb-cv');
      s.socialLinks.forEach(function(soc){
        const a = document.createElement('a');
        a.href = soc.url; a.target = '_blank'; a.className = 'tb-li';
        a.setAttribute('aria-label', soc.label || 'Social link');
        a.innerHTML = '<i class="' + soc.icon + '"></i><span class="tb-li-text">' + (soc.label || '') + '</span>';
        wrap.insertBefore(a, anchor || null);
      });
    });

    document.querySelectorAll('.footer-actions').forEach(function(wrap){
      const anchor = wrap.querySelector('a[download]');
      s.socialLinks.forEach(function(soc){
        const a = document.createElement('a');
        a.href = soc.url; a.target = '_blank'; a.className = 'footer-pill';
        a.innerHTML = '<i class="' + soc.icon + '"></i> ' + (soc.label || '');
        wrap.insertBefore(a, anchor || null);
      });
    });

    document.querySelectorAll('.contact-actions').forEach(function(wrap){
      s.socialLinks.forEach(function(soc){
        const a = document.createElement('a');
        a.href = soc.url; a.target = '_blank'; a.className = 'contact-pill green';
        a.innerHTML = '<i class="' + soc.icon + '"></i> ' + (soc.label || '');
        wrap.appendChild(a);
      });
    });
  }
}
