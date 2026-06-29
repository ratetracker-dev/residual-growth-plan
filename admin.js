/* ==========================================================================
   Rate Tracker - Admin Dashboard controller
   ========================================================================== */
(async function () {
  const sb = RTAuth.sb;
  const loading = document.getElementById('loadingScreen');
  const denied = document.getElementById('denied');
  const rootEl = document.getElementById('adminRoot');
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  document.documentElement.setAttribute('data-theme', matchMedia('(prefers-color-scheme:dark)').matches ? 'dark':'light');

  const user = await RTAuth.getUser();
  if (!user) { window.location.replace('index.html'); return; }
  const admin = await RTAuth.isAdmin();
  if (!admin) { loading.classList.add('hidden'); denied.classList.remove('hidden'); return; }

  document.getElementById('signout').addEventListener('click', () => RTAuth.signOut().then(()=>window.location.replace('index.html')));

  // Load all plans (RLS lets admins see everything)
  const { data: plans, error } = await sb.from('gp_plans').select('*').order('created_at', { ascending: false });
  loading.classList.add('hidden'); rootEl.classList.remove('hidden');
  if (error) { document.getElementById('tableArea').innerHTML = `<div class="empty">Could not load plans: ${esc(error.message)}</div>`; return; }

  const rows = plans || [];

  // Stats
  const fmtMoney = RT.fmtMoney;
  const totalGoal = rows.reduce((s,r)=>s+(+r.goal_13mo||0),0);
  const avgGoal = rows.length ? Math.round(totalGoal/rows.length) : 0;
  const last7 = rows.filter(r => (Date.now()-new Date(r.created_at).getTime()) < 7*864e5).length;
  const now = new Date();
  const thisMonth = rows.filter(r => { const d=new Date(r.created_at); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); }).length;
  document.getElementById('stats').innerHTML = `
    <div class="stat"><div class="n">${rows.length}</div><div class="l">Total plans generated</div></div>
    <div class="stat"><div class="n">${last7}</div><div class="l">New in the last 7 days</div></div>
    <div class="stat"><div class="n">${thisMonth}</div><div class="l">New this month</div></div>
    <div class="stat"><div class="n">${fmtMoney(avgGoal)}</div><div class="l">Average 13-month goal</div></div>`;

  // Tier breakdown
  const TIER_COLORS = { Builder:'#9aa0a6', Closer:'#45B72E', Operator:'#1f8f12', Empire:'#212121' };
  const tierCounts = rows.reduce((m,r)=>{ const t=r.tier||'Unassigned'; m[t]=(m[t]||0)+1; return m; },{});
  const tierOrder = ['Builder','Closer','Operator','Empire'];
  const tierKeys = Object.keys(tierCounts).sort((a,b)=>{ const ia=tierOrder.indexOf(a), ib=tierOrder.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });
  document.getElementById('tierbar').innerHTML = rows.length ? tierKeys.map(t =>
    `<span class="tierchip"><span class="dot" style="background:${TIER_COLORS[t]||'#9aa0a6'}"></span>${esc(t)} <b>${tierCounts[t]}</b></span>`).join('') : '';

  const fmtDate = d => new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

  // Sortable columns. key -> value accessor
  const SORTS = {
    name: r => (`${r.first_name||''} ${r.last_name||''}`).toLowerCase(),
    goal_13mo: r => +r.goal_13mo || 0,
    tier: r => tierOrder.indexOf(r.tier),
    total_accounts: r => +r.total_accounts || 0,
    channels: r => (r.channels||[]).length,
    created_at: r => new Date(r.created_at).getTime()
  };
  let sortKey = 'created_at', sortDir = -1; // default newest first
  let currentList = rows.slice();
  function sortList(list) {
    const fn = SORTS[sortKey];
    return list.slice().sort((a,b)=>{ const va=fn(a), vb=fn(b); return va<vb?-1*sortDir:va>vb?1*sortDir:0; });
  }
  const arrow = key => sortKey!==key ? '' : `<span class="arrow">${sortDir===1?'\u25b2':'\u25bc'}</span>`;

  function renderTable(list) {
    currentList = list;
    const area = document.getElementById('tableArea');
    if (!list.length) { area.innerHTML = `<div class="empty">No plans yet. They'll appear here as partners complete their intake.</div>`; return; }
    const sorted = sortList(list);
    area.innerHTML = `<table class="partners">
      <thead><tr>
        <th class="sortable" data-sort="name">Partner${arrow('name')}</th>
        <th class="sortable" data-sort="goal_13mo">13-mo goal${arrow('goal_13mo')}</th>
        <th class="sortable" data-sort="tier">Tier${arrow('tier')}</th>
        <th class="sortable" data-sort="total_accounts">Accounts${arrow('total_accounts')}</th>
        <th>Prospects/wk</th>
        <th class="sortable" data-sort="channels">Channels${arrow('channels')}</th>
        <th class="sortable" data-sort="created_at">Created${arrow('created_at')}</th>
      </tr></thead>
      <tbody>${sorted.map(r=>`
        <tr class="row" data-id="${r.id}">
          <td><b>${esc(r.first_name)} ${esc(r.last_name)}</b><div class="muted" style="font-size:.82rem">${esc(r.email)}</div></td>
          <td>${fmtMoney(r.goal_13mo)}/mo</td>
          <td><span class="tier-pill">${esc(r.tier||'\u2013')}</span></td>
          <td>${r.total_accounts??'\u2013'}</td>
          <td>${r.prospects_low!=null?r.prospects_low+'\u2013'+r.prospects_high:'\u2013'}</td>
          <td>${(r.channels||[]).length}</td>
          <td class="muted">${fmtDate(r.created_at)}</td>
        </tr>`).join('')}</tbody></table>`;
    area.querySelectorAll('tr.row').forEach(tr => tr.addEventListener('click', ()=>openDrawer(list.find(x=>x.id===tr.dataset.id))));
    area.querySelectorAll('th.sortable').forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (sortKey===k) sortDir*=-1; else { sortKey=k; sortDir = (k==='name'||k==='tier')?1:-1; }
      renderTable(currentList);
    }));
  }

  // Search
  const search = document.getElementById('search');
  function applySearch() {
    const q = search.value.trim().toLowerCase();
    renderTable(!q ? rows : rows.filter(r =>
      (`${r.first_name} ${r.last_name}`).toLowerCase().includes(q) || (r.email||'').toLowerCase().includes(q)));
  }
  search.addEventListener('input', applySearch);

  // CSV export (exports whatever is currently filtered + sorted)
  document.getElementById('exportCsv').addEventListener('click', () => {
    const cols = [
      ['First name','first_name'],['Last name','last_name'],['Email','email'],
      ['Tier','tier'],['13-mo goal','goal_13mo'],['37-mo goal','goal_37mo'],['61-mo goal','goal_61mo'],
      ['Living expenses','living_expenses'],['Financially free','financially_free'],
      ['Accounts needed','total_accounts'],['Accounts/month','accounts_per_month'],
      ['Prospects/wk low','prospects_low'],['Prospects/wk high','prospects_high'],
      ['Channels','__channels'],['Invincible','invincible'],['Created','__created']
    ];
    const q = s => '"' + String(s==null?'':s).replace(/"/g,'""') + '"';
    const data = sortList(currentList);
    const lines = [cols.map(c=>q(c[0])).join(',')];
    data.forEach(r => lines.push(cols.map(c => {
      if (c[1]==='__channels') return q((r.channels||[]).map(x=>RT.CHANNEL_LABELS[x]||x).join('; '));
      if (c[1]==='__created') return q(new Date(r.created_at).toLocaleString('en-US'));
      return q(r[c[1]]);
    }).join(',')));
    const blob = new Blob([lines.join('\r\n')], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `growth-plans-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  });

  // Drawer
  const drawer = document.getElementById('drawer');
  const back = document.getElementById('drawerBack');
  function closeDrawer(){ drawer.classList.remove('open'); back.classList.remove('open'); }
  back.addEventListener('click', closeDrawer);

  function openDrawer(r) {
    if (!r) return;
    const ch = (r.channels||[]).map(c => `<span class="d-tag">${esc(RT.CHANNEL_LABELS[c]||c)}</span>`).join('') || '<span class="muted">None selected</span>';
    drawer.innerHTML = `
      <div class="drawer-head">
        <button class="x" id="closeX">&times;</button>
        <div class="eyebrow" style="color:var(--rt-green)">${esc(r.tier||'')} Tier</div>
        <h2>${esc(r.first_name)} ${esc(r.last_name)}</h2>
        <div class="em">${esc(r.email)} \u00b7 ${fmtDate(r.created_at)} <button class="copybtn" id="copyEmail" data-email="${esc(r.email)}">Copy email</button></div>
      </div>
      <div class="drawer-body">
        <div class="d-section"><h3>Computed plan</h3>
          <div class="d-grid">
            <div class="d-cell"><div class="k">Accounts needed</div><div class="v">${r.total_accounts??'\u2013'}</div></div>
            <div class="d-cell"><div class="k">New accts/month</div><div class="v">~${r.accounts_per_month??'\u2013'}/mo</div></div>
            <div class="d-cell"><div class="k">Prospects/week</div><div class="v">${r.prospects_low!=null?r.prospects_low+'\u2013'+r.prospects_high:'\u2013'}</div></div>
            <div class="d-cell"><div class="k">Social posts/wk</div><div class="v">${r.social_low!=null?r.social_low+'\u2013'+r.social_high:'\u2013'}</div></div>
          </div>
        </div>
        <div class="d-section"><h3>Income targets</h3>
          <div class="d-grid">
            <div class="d-cell"><div class="k">Living expenses</div><div class="v">${r.living_expenses?fmtMoney(r.living_expenses):'\u2013'}</div></div>
            <div class="d-cell"><div class="k">Financially free</div><div class="v">${r.financially_free?fmtMoney(r.financially_free):'\u2013'}</div></div>
            <div class="d-cell"><div class="k">13-month goal</div><div class="v">${fmtMoney(r.goal_13mo)}</div></div>
            <div class="d-cell"><div class="k">37-month goal</div><div class="v">${r.goal_37mo?fmtMoney(r.goal_37mo):'\u2013'}</div></div>
            <div class="d-cell"><div class="k">61-month goal</div><div class="v">${r.goal_61mo?fmtMoney(r.goal_61mo):'\u2013'}</div></div>
          </div>
        </div>
        <div class="d-section"><h3>Lead channels (${(r.channels||[]).length})</h3><div class="d-list">${ch}</div></div>
        ${r.invincible?`<div class="d-section"><h3>What would make them invincible</h3><div class="d-text">${esc(r.invincible)}</div></div>`:''}
      </div>`;
    drawer.querySelector('#closeX').addEventListener('click', closeDrawer);
    const cb = drawer.querySelector('#copyEmail');
    if (cb) cb.addEventListener('click', () => {
      const em = cb.dataset.email;
      navigator.clipboard.writeText(em).then(()=>{ const t=cb.textContent; cb.textContent='Copied'; setTimeout(()=>cb.textContent=t,1200); }).catch(()=>{});
    });
    drawer.classList.add('open'); back.classList.add('open');
  }

  renderTable(rows);

  // ====================== Referrals panel ======================
  (async function referrals(){
    const block = document.getElementById('referralsBlock');
    if (!(window.RTReferral && RTReferral.enabled)) { if (block) block.style.display='none'; return; }

    // Map ref_code -> plan owner name, so we can show "who referred them".
    const byCode = {};
    rows.forEach(r => { if (r.ref_code) byCode[r.ref_code.toUpperCase()] = r; });
    // Map user_id -> plan, to name the referred person if they have a plan.
    const byUser = {};
    rows.forEach(r => { if (r.user_id) byUser[r.user_id] = r; });

    const { data: refs, error: refErr } = await sb.from('gp_referrals').select('*').order('created_at',{ascending:false});
    const refArea = document.getElementById('refTableArea');
    if (refErr) { refArea.innerHTML = `<div class="empty">Could not load referrals: ${esc(refErr.message)}</div>`; return; }
    let list = refs || [];

    document.getElementById('refCount').textContent = list.length ? `(${list.length})` : '';

    function refStats(){
      const signed = list.filter(x=>x.status==='signed').length;
      const sharers = new Set(list.map(x=>x.referrer_code)).size;
      document.getElementById('refStats').innerHTML = `
        <div class="stat"><div class="n">${list.length}</div><div class="l">People referred in</div></div>
        <div class="stat"><div class="n">${sharers}</div><div class="l">Unique sharers</div></div>
        <div class="stat"><div class="n">${signed}</div><div class="l">Referrals signed as partners</div></div>`;
    }

    function referrerName(code){
      const p = byCode[(code||'').toUpperCase()];
      return p ? `${p.first_name} ${p.last_name}` : '\u2013';
    }
    function referredName(rf){
      const p = rf.referred_user_id ? byUser[rf.referred_user_id] : null;
      if (p) return `${p.first_name} ${p.last_name}`;
      return rf.referred_email || '\u2013';
    }

    function renderRefs(){
      refStats();
      if (!list.length){ refArea.innerHTML = `<div class="empty">No referrals yet. They'll appear here as partners share their link and new reps generate plans.</div>`; return; }
      refArea.innerHTML = `<table class="partners">
        <thead><tr>
          <th>Referred person</th><th>Referred by</th><th>Their code</th><th>Status</th><th>When</th><th></th>
        </tr></thead>
        <tbody>${list.map(rf=>`
          <tr data-id="${rf.id}">
            <td><b>${esc(referredName(rf))}</b>${rf.referred_email?`<div class="muted" style="font-size:.82rem">${esc(rf.referred_email)}</div>`:''}</td>
            <td>${esc(referrerName(rf.referrer_code))}</td>
            <td><span class="refcode">${esc(rf.referrer_code)}</span></td>
            <td><span class="statuspill ${rf.status==='signed'?'signed':'generated_plan'}">${rf.status==='signed'?'Signed':'Generated plan'}</span></td>
            <td class="muted">${fmtDate(rf.created_at)}</td>
            <td>${rf.status==='signed'
              ? `<button class="signbtn undo" data-undo="${rf.id}">Undo</button>`
              : `<button class="signbtn" data-sign="${rf.id}">Mark signed</button>`}</td>
          </tr>`).join('')}</tbody></table>`;
      refArea.querySelectorAll('[data-sign]').forEach(b => b.addEventListener('click', ()=>flip(b.dataset.sign, 'signed', b)));
      refArea.querySelectorAll('[data-undo]').forEach(b => b.addEventListener('click', ()=>flip(b.dataset.undo, 'generated_plan', b)));
    }

    async function flip(id, status, btn){
      const prev = btn.textContent; btn.textContent = '...'; btn.disabled = true;
      const patch = status==='signed'
        ? { status:'signed', signed_at:new Date().toISOString(), signed_by:user.id }
        : { status:'generated_plan', signed_at:null, signed_by:null };
      const { error } = await sb.from('gp_referrals').update(patch).eq('id', id);
      if (error){ btn.textContent = prev; btn.disabled=false; alert('Could not update: '+error.message); return; }
      const rf = list.find(x=>x.id===id); if (rf) Object.assign(rf, patch);
      renderRefs();
    }

    renderRefs();
  })();
})();
