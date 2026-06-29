/* Google Analytics 4 - Residual Growth Plan
   Loads gtag, configures the property, and exposes RTA.track() for custom events.
   No personal data (names, emails) is ever sent to GA4, per Google policy. */
(function () {
  var GA_ID = 'G-RKS48Y45SK';

  // Load the gtag library
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID);

  // Lightweight helper for custom events. Safe to call even if gtag is slow to load.
  window.RTA = {
    track: function (name, params) {
      try { window.gtag('event', name, params || {}); } catch (e) {}
    }
  };

  // Auto-track any click on a "Become a partner" link (growmyresidual.com).
  // Delegated so it also catches the dynamically rendered link on the report.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href*="growmyresidual.com"]') : null;
    if (a) {
      window.RTA.track('partner_cta_click', { location: document.title || location.pathname });
    }
  }, true);
})();
