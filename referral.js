/* ==========================================================================
   Rate Tracker - Referral / affiliate helpers
   Generates each partner a shareable ref code, captures an incoming ?ref=
   code on landing, and attributes a new plan back to whoever referred them.
   Requires: config.js + auth.js (RTAuth.sb) loaded first.
   Guarded by RT_CONFIG.REFERRAL_ENABLED - flip that flag to disable everywhere.
   ========================================================================== */
window.RTReferral = (function () {
  var CFG = window.RT_CONFIG || {};
  var enabled = !!CFG.REFERRAL_ENABLED;
  var STORE_KEY = 'rt_ref_pending'; // incoming referral code held until plan save

  // Short, friendly, unambiguous code (no O/0/I/1). e.g. RGP-7K2QX
  function makeCode() {
    var alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < 5; i++) out += alpha[Math.floor(Math.random() * alpha.length)];
    return 'RGP-' + out;
  }

  // Capture ?ref=CODE from the URL and remember it (survives login redirect).
  // Safe to call on any public page. Never overwrites an already-stored code.
  function captureFromUrl() {
    if (!enabled) return;
    try {
      var code = new URLSearchParams(window.location.search).get('ref');
      if (code && /^RGP-[A-Z0-9]{4,8}$/i.test(code)) {
        if (!localStorage.getItem(STORE_KEY)) {
          localStorage.setItem(STORE_KEY, code.toUpperCase());
        }
        if (window.RTA) RTA.track('arrived_via_referral', { ref: code.toUpperCase() });
      }
    } catch (e) {}
  }

  function pendingCode() {
    try { return enabled ? localStorage.getItem(STORE_KEY) : null; } catch (e) { return null; }
  }
  function clearPending() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  // Build the public share link for a given code.
  function shareLink(code) {
    return 'https://residualgrowthplan.com/?ref=' + encodeURIComponent(code);
  }

  // Ensure the saved plan row has a ref_code; if missing, mint one and persist.
  // Returns the (possibly new) code. `row` is the saved gp_plans record.
  async function ensureRefCode(sb, row) {
    if (!enabled || !row) return null;
    if (row.ref_code) return row.ref_code;
    // Try a few times in case of a unique collision (extremely unlikely).
    for (var attempt = 0; attempt < 4; attempt++) {
      var code = makeCode();
      var res = await sb.from('gp_plans').update({ ref_code: code }).eq('id', row.id).select('ref_code').single();
      if (!res.error && res.data) { row.ref_code = res.data.ref_code; return row.ref_code; }
    }
    return null;
  }

  // If this user arrived via someone's referral link, log the attribution once.
  // Idempotent: the DB unique index (referrer_code, referred_user_id) prevents dupes,
  // and we also short-circuit if the plan already records a referred_by_code.
  async function attributeReferral(sb, user, row) {
    if (!enabled || !user || !row) return;
    var code = row.referred_by_code || pendingCode();
    if (!code) return;
    code = code.toUpperCase();

    // Don't let someone be credited as their own referrer.
    if (row.ref_code && row.ref_code.toUpperCase() === code) { clearPending(); return; }

    // Stamp the plan with who referred them (once).
    if (!row.referred_by_code) {
      await sb.from('gp_plans').update({ referred_by_code: code }).eq('id', row.id).catch(function(){});
      row.referred_by_code = code;
    }

    // Look up the referrer's user_id so admin views can link back.
    var referrerUserId = null;
    try {
      var lk = await sb.from('gp_plans').select('user_id').eq('ref_code', code).limit(1).single();
      if (!lk.error && lk.data) referrerUserId = lk.data.user_id;
    } catch (e) {}

    // Insert the referral journey row (unique index makes this safe to retry).
    await sb.from('gp_referrals').insert({
      referrer_code: code,
      referrer_user_id: referrerUserId,
      referred_email: row.email || user.email || null,
      referred_user_id: user.id,
      status: 'generated_plan'
    }).then(function(){ clearPending(); }).catch(function(){ clearPending(); });

    if (window.RTA) RTA.track('referral_attributed', { ref: code });
  }

  return {
    enabled: enabled,
    makeCode: makeCode,
    captureFromUrl: captureFromUrl,
    pendingCode: pendingCode,
    clearPending: clearPending,
    shareLink: shareLink,
    ensureRefCode: ensureRefCode,
    attributeReferral: attributeReferral
  };
})();
