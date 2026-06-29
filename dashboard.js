/* ==========================================================================
   Rate Tracker - Standalone Analytics Dashboard
   Read-only view over gp_plans + gp_referrals, with a demo-data overlay.
   Same admin gate as admin.html. GA4 traffic shown as deep-links + (demo) stats.
   ========================================================================== */
(async function () {
  const sb = RTAuth.sb;
  const loading = document.getElementById('loadingScreen');
  const denied = document.getElementById('denied');
  const rootEl = document.getElementById('dashRoot');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isDark = matchMedia('(prefers-color-scheme:dark)').matches;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

  // ---- GA4 launchpad: direct shortcuts into Google Analytics reports for residualgrowthplan.com ----
  // Numbers live in GA4 itself (the account is owned by the user's org), so the dashboard just gets
  // you there fast instead of trying to embed live data. Each card opens the relevant report area.
  const GA_BASE = 'https://analytics.google.com/analytics/web/#/p0';
  const gaReports = [
    {
      title: 'Realtime overview',
      desc: 'Who is on the site right now, by page and source.',
      href: GA_BASE + '/realtime/overview',
      icon: '<circle cx="12" cy="12" r="3"/><path d="M3 12a9 9 0 0 1 9-9M21 12a9 9 0 0 1-9 9"/>'
    },
    {
      title: 'Traffic acquisition',
      desc: 'Where your visitors come from: search, social, direct, referral.',
      href: GA_BASE + '/reports/explorer?params=_u..nav%3Dmaui&r=lifecycle-traffic-acquisition-v2',
      icon: '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>'
    },
    {
      title: 'Pages and screens',
      desc: 'Most-viewed pages and how long people stay.',
      href: GA_BASE + '/reports/explorer?params=_u..nav%3Dmaui&r=all-pages-and-screens',
      icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'
    },
    {
      title: 'Events',
      desc: 'Plan builds, partner CTA clicks, login links and more.',
      href: GA_BASE + '/reports/explorer?params=_u..nav%3Dmaui&r=lifecycle-engagement-events',
      icon: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'
    }
  ];
  document.getElementById('gaLinks').innerHTML = gaReports.map(r =>
    `<a class="ga-card" href="${r.href}" target="_blank" rel="noopener">`
    + `<span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${r.icon}</svg></span>`
    + `<span class="txt"><span class="ttl">${r.title} <span class="arr">&#8599;</span></span><span class="dsc">${r.desc}</span></span>`
    + `</a>`
  ).join('');

  // ---- Auth gate (identical to admin) ----
  const user = await RTAuth.getUser();
  if (!user) { window.location.replace('index.html'); return; }
  const admin = await RTAuth.isAdmin();
  if (!admin) { loading.classList.add('hidden'); denied.classList.remove('hidden'); return; }

  document.getElementById('signout').addEventListener('click', () => RTAuth.signOut().then(() => window.location.replace('index.html')));

  // ---- Load live data ----
  const [{ data: plansData }, { data: refsData }] = await Promise.all([
    sb.from('gp_plans').select('*').order('created_at', { ascending: false }),
    sb.from('gp_referrals').select('*').order('created_at', { ascending: false })
  ]);
  const livePlans = plansData || [];
  const liveRefs = refsData || [];

  document.getElementById('updated').textContent = 'Live data \u00b7 updated ' + new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const fmtMoney = (window.RT && RT.fmtMoney) ? RT.fmtMoney : (n => '$' + Math.round(+n || 0).toLocaleString('en-US'));
  const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // ===================== DEMO SAMPLE DATA =====================
  // Illustrative only. Never written to the database.
  function demoDataset() {
    const now = Date.now(), DAY = 864e5;
    const first = ['Marcus', 'Jenna', 'Devon', 'Priya', 'Carlos', 'Aisha', 'Tyler', 'Nina', 'Greg', 'Sofia', 'Andre', 'Beth', 'Liam', 'Rosa', 'Omar'];
    const last = ['Ellis', 'Park', 'Reyes', 'Shah', 'Mendez', 'Khan', 'Brooks', 'Vance', 'Doyle', 'Russo', 'Cole', 'Fry', 'Nash', 'Lima', 'Said'];
    const tiers = ['Builder', 'Closer', 'Closer', 'Operator', 'Operator', 'Operator', 'Empire'];
    const goals = [8000, 12000, 15000, 20000, 20000, 35000, 50000, 80000];
    const chans = ['cold_calling', 'referral_partners', 'networking', 'organic_social', 'paid_ads', 'associations'];
    const plans = [];
    for (let i = 0; i < 42; i++) {
      const ageDays = Math.floor(Math.pow(Math.random(), 1.4) * 56); // skew recent
      const g = goals[Math.floor(Math.random() * goals.length)];
      plans.push({
        id: 'demo-p-' + i,
        user_id: 'demo-u-' + i,
        first_name: first[i % first.length],
        last_name: last[(i * 3) % last.length],
        email: (first[i % first.length] + '.' + last[(i * 3) % last.length]).toLowerCase() + '@example.com',
        goal_13mo: g,
        tier: tiers[Math.min(tiers.length - 1, Math.floor(g / 12000))] || tiers[Math.floor(Math.random() * tiers.length)],
        total_accounts: Math.round(g / 150),
        channels: chans.slice(0, 2 + Math.floor(Math.random() * 3)),
        ref_code: 'RGP-' + (1000 + i).toString(36).toUpperCase().padStart(5, 'X').slice(-5),
        created_at: new Date(now - ageDays * DAY).toISOString()
      });
    }
    // Referrals: ~22 people referred in by ~9 sharers, 6 signed.
    const refs = [];
    const sharerPlans = plans.slice(0, 9);
    for (let i = 0; i < 22; i++) {
      const sp = sharerPlans[i % sharerPlans.length];
      const ageDays = Math.floor(Math.pow(Math.random(), 1.3) * 48);
      const signed = i < 6;
      refs.push({
        id: 'demo-r-' + i,
        referrer_code: sp.ref_code,
        referrer_user_id: sp.user_id,
        referred_email: (first[(i + 4) % first.length] + '.' + last[(i + 7) % last.length]).toLowerCase() + '@example.com',
        referred_user_id: i % 2 === 0 ? 'demo-ru-' + i : null,
        status: signed ? 'signed' : 'generated_plan',
        created_at: new Date(now - ageDays * DAY).toISOString(),
        signed_at: signed ? new Date(now - (ageDays - 2) * DAY).toISOString() : null
      });
    }
    return { plans, refs };
  }

  // ===================== RENDER =====================
  let plansChart = null, tierChart = null;

  // Draws "No data yet" in the middle of an empty doughnut so it never looks broken.
  const emptyCenterText = {
    id: 'emptyCenterText',
    afterDraw(chart) {
      const c = chart.ctx, a = chart.chartArea;
      c.save();
      c.font = "600 13px 'Open Sans', sans-serif";
      c.fillStyle = isDark ? '#9aa0a6' : '#6b736b';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('No data yet', (a.left + a.right) / 2, (a.top + a.bottom) / 2);
      c.restore();
    }
  };

  function render(plans, refs) {
    renderKpis(plans, refs);
    renderPlansChart(plans);
    renderFunnel(plans, refs);
    renderSharers(plans, refs);
    renderTiers(plans);
    renderRefLinks(plans, refs);
  }

  const within = (r, days) => (Date.now() - new Date(r.created_at).getTime()) < days * 864e5;

  function renderKpis(plans, refs) {
    const last7 = plans.filter(r => within(r, 7)).length;
    const prev7 = plans.filter(r => !within(r, 7) && within(r, 14)).length;
    const signed = refs.filter(r => r.status === 'signed').length;
    const convPct = refs.length ? Math.round((signed / refs.length) * 100) : 0;
    // Delta: suppress the misleading 0->1 "100%" jump; use neutral copy on a zero base.
    let deltaTxt;
    if (last7 === 0 && prev7 === 0) deltaTxt = '<span class="d flat">No change yet</span>';
    else if (prev7 === 0) deltaTxt = `<span class="d up">&#9650; ${last7} new this week</span>`;
    else {
      const delta = Math.round(((last7 - prev7) / prev7) * 100);
      deltaTxt = delta >= 0
        ? `<span class="d up">&#9650; ${delta}% vs prior 7 days</span>`
        : `<span class="d flat">&#9660; ${Math.abs(delta)}% vs prior 7 days</span>`;
    }
    // Keep all four cards the same height: every card carries a delta-row slot.
    document.getElementById('stats').innerHTML = `
      <div class="stat"><div class="n">${plans.length}</div><div class="l">Plans generated</div>${deltaTxt}</div>
      <div class="stat"><div class="n">${refs.length}</div><div class="l">People referred in</div><span class="d flat">From shared links</span></div>
      <div class="stat"><div class="n">${signed}</div><div class="l">Referrals signed as partners</div><span class="d flat">Completed agreement</span></div>
      <div class="stat"><div class="n">${convPct}%</div><div class="l">Referral conversion rate</div><span class="d flat">Referred to signed</span></div>`;
  }

  function weekKey(d) {
    const dt = new Date(d); const day = (dt.getDay() + 6) % 7; // Monday start
    dt.setDate(dt.getDate() - day); dt.setHours(0, 0, 0, 0); return dt;
  }
  function renderPlansChart(plans) {
    // Last 8 weeks
    const weeks = [];
    const base = weekKey(Date.now());
    for (let i = 7; i >= 0; i--) { const d = new Date(base); d.setDate(d.getDate() - i * 7); weeks.push(d); }
    const counts = weeks.map(w => plans.filter(p => weekKey(p.created_at).getTime() === w.getTime()).length);
    const labels = weeks.map(w => w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const peak = Math.max(...counts, 0);
    const suggestedMax = peak < 4 ? 4 : undefined; // avoid an orphan "1" axis on near-empty data
    const green = '#45B72E', deep = '#256916';
    const ctx = document.getElementById('plansChart');
    if (plansChart) plansChart.destroy();
    plansChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Plans', data: counts, backgroundColor: green, hoverBackgroundColor: deep, borderRadius: 6, maxBarThickness: 46 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.y} plan${c.parsed.y === 1 ? '' : 's'}` } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: isDark ? '#9aa0a6' : '#6b736b', font: { family: 'Open Sans' } } },
          y: { beginAtZero: true, suggestedMax, ticks: { precision: 0, stepSize: 1, color: isDark ? '#9aa0a6' : '#6b736b' }, grid: { color: isDark ? '#2a302b' : '#eef2ee' } }
        }
      }
    });
  }

  function renderFunnel(plans, refs) {
    const generated = plans.length;
    const shared = new Set(refs.map(r => r.referrer_code).filter(Boolean)).size;
    const referredIn = refs.length;
    const signed = refs.filter(r => r.status === 'signed').length;
    const steps = [
      ['Plans generated', generated, 'Reps who built a free plan'],
      ['Sharing their link', shared, 'Plans that have referred at least one person'],
      ['New people referred in', referredIn, 'Built a plan from a shared link'],
      ['Signed as partners', signed, 'Completed a partner agreement']
    ];
    const max = Math.max(generated, 1);
    document.getElementById('funnel').innerHTML = steps.map(([t, v, sub]) => {
      const pct = Math.max(8, Math.round((v / max) * 100));
      return `<div class="fstep"><div class="meta"><b>${esc(t)}</b><span>${esc(sub)}</span></div><div class="track"><div class="bar" style="width:${pct}%">${v}</div></div></div>`;
    }).join('');
  }

  function renderSharers(plans, refs) {
    const byCode = {};
    plans.forEach(p => { if (p.ref_code) byCode[p.ref_code.toUpperCase()] = p; });
    const agg = {};
    refs.forEach(r => {
      const c = (r.referrer_code || '').toUpperCase(); if (!c) return;
      agg[c] = agg[c] || { code: c, referred: 0, signed: 0 };
      agg[c].referred++; if (r.status === 'signed') agg[c].signed++;
    });
    const list = Object.values(agg).sort((a, b) => b.referred - a.referred || b.signed - a.signed).slice(0, 8);
    const area = document.getElementById('sharersArea');
    if (!list.length) { area.innerHTML = `<div class="empty">No shares yet. As partners send their links, the top sharers will rank here.</div>`; return; }
    area.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr><th>Sharer</th><th>Code</th><th>Referred</th><th>Signed</th></tr></thead><tbody>${list.map(s => {
      const p = byCode[s.code];
      const name = p ? `${esc(p.first_name)} ${esc(p.last_name)}` : '\u2013';
      return `<tr><td><b>${name}</b></td><td><span class="refcode">${esc(s.code)}</span></td><td>${s.referred}</td><td>${s.signed}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function renderTiers(plans) {
    const TIER_COLORS = { Builder: '#9aa0a6', Closer: '#7ace66', Operator: '#45B72E', Empire: '#256916' };
    const order = ['Builder', 'Closer', 'Operator', 'Empire'];
    const counts = plans.reduce((m, r) => { const t = r.tier || 'Unassigned'; m[t] = (m[t] || 0) + 1; return m; }, {});
    const keys = Object.keys(counts).sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
    const ctx = document.getElementById('tierChart');
    if (tierChart) tierChart.destroy();
    if (!keys.length) {
      document.getElementById('tierbar').innerHTML = '<span class="tierchip" style="color:var(--text-muted)">No plans built yet</span>';
      tierChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['No plans yet'], datasets: [{ data: [1], backgroundColor: [isDark ? '#2a302b' : '#e2e8e2'] }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }, plugins: [emptyCenterText] });
      return;
    }
    tierChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: keys, datasets: [{ data: keys.map(k => counts[k]), backgroundColor: keys.map(k => TIER_COLORS[k] || '#9aa0a6'), borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false } } }
    });
    document.getElementById('tierbar').innerHTML = keys.map(t => `<span class="tierchip"><span class="dot" style="background:${TIER_COLORS[t] || '#9aa0a6'}"></span>${esc(t)} <b>${counts[t]}</b></span>`).join('');
  }

  function renderRefLinks(plans, refs) {
    const byCode = {};
    plans.forEach(p => { if (p.ref_code) byCode[p.ref_code.toUpperCase()] = p; });
    const agg = {};
    refs.forEach(r => {
      const c = (r.referrer_code || '').toUpperCase(); if (!c) return;
      agg[c] = agg[c] || { referred: 0, signed: 0 };
      agg[c].referred++; if (r.status === 'signed') agg[c].signed++;
    });
    // Show every plan that has a code; sort by referrals desc then newest.
    const coded = plans.filter(p => p.ref_code).sort((a, b) => {
      const ra = (agg[a.ref_code.toUpperCase()] || {}).referred || 0;
      const rb = (agg[b.ref_code.toUpperCase()] || {}).referred || 0;
      return rb - ra || new Date(b.created_at) - new Date(a.created_at);
    }).slice(0, 12);
    const area = document.getElementById('refLinksArea');
    if (!coded.length) { area.innerHTML = `<div class="empty">No referral links yet. Each finished plan mints one automatically; they will list here with their performance.</div>`; return; }
    area.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr><th>Owner</th><th>Share link</th><th>Referred</th><th>Signed</th><th>Status</th></tr></thead><tbody>${coded.map(p => {
      const code = p.ref_code.toUpperCase();
      const a = agg[code] || { referred: 0, signed: 0 };
      const link = `residualgrowthplan.com/?ref=${esc(code)}`;
      const status = a.signed > 0 ? '<span class="pill signed">Converting</span>' : (a.referred > 0 ? '<span class="pill gen">Sharing</span>' : '<span class="pill gen">Issued</span>');
      return `<tr><td><b>${esc(p.first_name)} ${esc(p.last_name)}</b></td><td><span class="refcode">${link}</span></td><td>${a.referred}</td><td>${a.signed}</td><td>${status}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  // ---- initial render (live) ----
  loading.classList.add('hidden');
  rootEl.classList.remove('hidden');
  render(livePlans, liveRefs);

  // ---- demo toggle ----
  const toggle = document.getElementById('demoToggle');
  let demo = null;
  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      document.body.setAttribute('data-demo', 'on');
      document.getElementById('updated').textContent = 'Demo data \u00b7 illustrative sample, not live results';
      demo = demo || demoDataset();
      render(demo.plans, demo.refs);
    } else {
      document.body.removeAttribute('data-demo');
      document.getElementById('updated').textContent = 'Live data \u00b7 updated ' + new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      render(livePlans, liveRefs);
    }
  });
})();
