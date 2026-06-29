/* ==========================================================================
   Rate Tracker - App controller (app.html)
   Auth gate -> load existing plan OR show wizard -> compute + save -> report.
   ========================================================================== */
(async function () {
  const root = document.getElementById('appRoot');
  const loading = document.getElementById('loadingScreen');
  const gen = document.getElementById('genOverlay');
  const show = el => { [loading, gen].forEach(x => x.classList.add('hidden')); root.classList.remove('hidden'); };
  const sb = RTAuth.sb;

  // Reject a promise if it takes too long, so a stalled network call surfaces
  // as a real error instead of an endless spinner.
  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error((label || 'Request') + ' timed out')), ms))
    ]);
  }

  // Friendly fatal-error screen so we never spin forever.
  function fatal(msg) {
    [loading, gen].forEach(x => x.classList.add('hidden'));
    root.classList.remove('hidden');
    root.innerHTML =
      '<div style="max-width:520px;margin:12vh auto;text-align:center;font-family:Open Sans,sans-serif;padding:0 24px">' +
      '<h2 style="font-family:Poppins,sans-serif;font-size:1.5rem;margin-bottom:.6rem">Something went sideways</h2>' +
      '<p style="color:#555;margin-bottom:1.4rem">' + msg + '</p>' +
      '<a href="login.html" style="display:inline-block;background:#45B72E;color:#fff;font-weight:700;' +
      'padding:.7rem 1.4rem;border-radius:999px;text-decoration:none;font-family:Poppins,sans-serif">' +
      'Back to sign in</a></div>';
  }

  try {

  // If the magic link came back with an explicit auth error, surface it cleanly.
  const errDesc = new URLSearchParams(
    (window.location.hash || '').replace(/^#/, '') + '&' + (window.location.search || '').replace(/^\?/, '')
  ).get('error_description');
  if (errDesc) { fatal('Your login link could not be used (' + errDesc + '). Please request a fresh link.'); return; }

  // 1. Require login
  const user = await RTAuth.getUser();
  if (!user) {
    // If we arrived from a link but still have no session, the link likely expired.
    if (/access_token|refresh_token|[?&]code=/.test(window.location.hash + window.location.search)) {
      fatal('Your login link has expired or was already used. Please request a fresh link.'); return;
    }
    window.location.replace('login.html'); return;
  }
  // Clean the auth tokens out of the URL bar for a tidy address.
  if (window.history.replaceState && (window.location.hash || window.location.search)) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  const admin = await withTimeout(RTAuth.isAdmin(), 8000, 'Admin check').catch(() => false);

  // 2. Build the computed fields from answers (for storage + admin)
  function buildRow(ans) {
    const r = RT.compute(ans.goal_13mo);
    return {
      user_id: user.id,
      first_name: ans.first_name, last_name: ans.last_name, email: ans.email,
      living_expenses: ans.living_expenses, financially_free: ans.financially_free,
      goal_13mo: ans.goal_13mo, goal_37mo: ans.goal_37mo, goal_61mo: ans.goal_61mo,
      invincible: ans.invincible, channels: ans.channels,
      tier: r.tier, total_accounts: r.accounts, accounts_per_month: r.perMonth,
      prospects_low: r.prospectsLow, prospects_high: r.prospectsHigh,
      social_low: r.socialLow, social_high: r.socialHigh,
      followups_low: r.followupsLow, followups_high: r.followupsHigh,
      referral_partners: r.rpHigh,
      plan_json: { answers: ans, computed: r },
      status: 'completed'
    };
  }

  // Map a DB row back into the shape the report/wizard expect
  function rowToPlan(row) {
    return {
      first_name: row.first_name, last_name: row.last_name, email: row.email,
      living_expenses: row.living_expenses, financially_free: row.financially_free,
      goal_13mo: row.goal_13mo, goal_37mo: row.goal_37mo, goal_61mo: row.goal_61mo,
      invincible: row.invincible, channels: row.channels || []
    };
  }

  async function loadLatestPlan() {
    try {
      const { data, error } = await withTimeout(
        sb.from('gp_plans').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(1),
        10000, 'Loading your plan');
      if (error) { console.error(error); return null; }
      return (data && data[0]) || null;
    } catch (e) { console.error(e); return null; }
  }

  let currentRow = await loadLatestPlan();

  function signOut() { RTAuth.signOut().then(() => window.location.replace('login.html')); }

  function showReport(row) {
    show();
    RTReport.render(root, rowToPlan(row), {
      isAdmin: admin,
      onSignout: signOut,
      onEdit: () => startWizard(rowToPlan(row))
    });
  }

  function startWizard(prefill) {
    show();
    const api = RTWizard.render(root, prefill || { email: user.email }, async (ans) => {
      gen.classList.remove('hidden');
      const row = buildRow(ans);
      // Update existing plan if present, else insert new
      let saved, err;
      try {
        if (currentRow) {
          const res = await withTimeout(
            sb.from('gp_plans').update(row).eq('id', currentRow.id).select().single(),
            12000, 'Saving your plan');
          saved = res.data; err = res.error;
        } else {
          const res = await withTimeout(
            sb.from('gp_plans').insert(row).select().single(),
            12000, 'Saving your plan');
          saved = res.data; err = res.error;
        }
      } catch (timeoutErr) {
        err = timeoutErr;
      }
      if (err || !saved) {
        gen.classList.add('hidden');
        fatal('We could not save your plan (' + ((err && err.message) || 'unknown error') +
              '). Your answers are safe. Please try again in a moment.');
        return;
      }
      const isNewPlan = !currentRow;
      currentRow = saved;
      if (window.RTA) RTA.track(isNewPlan ? 'plan_generated' : 'plan_updated', { tier: saved.tier || 'unknown' });
      setTimeout(() => showReport(saved), 700); // brief "building" beat
    });
    api.setWho(user.email);
    api.onSignout(signOut);
  }

  // 3. Route: existing plan -> report, else -> wizard
  if (currentRow) showReport(currentRow);
  else startWizard({ email: user.email });

  } catch (e) {
    console.error(e);
    fatal('We hit an unexpected error loading your plan. Please try your sign-in link again.');
  }
})();
