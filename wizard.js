/* ==========================================================================
   Rate Tracker - Intake Wizard
   Renders a multi-step form mirroring the 10 HubSpot fields, with a live
   preview that shows the computed plan updating as the partner types.
   Calls onComplete(answers) when submitted.
   ========================================================================== */
window.RTWizard = (function () {
  const CHANNEL_OPTS = [
    'Door Knocking', 'Cold Calling', 'Paid Advertisements',
    'Referral From Existing Clients', 'Organic Social Media',
    'Networking Events', 'Referral Partners'
  ];

  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function render(root, prefill, onComplete) {
    prefill = prefill || {};
    const state = {
      step: 0,
      first_name: prefill.first_name || '',
      last_name: prefill.last_name || '',
      email: prefill.email || '',
      living_expenses: prefill.living_expenses || '',
      financially_free: prefill.financially_free || '',
      goal_13mo: prefill.goal_13mo || '',
      goal_37mo: prefill.goal_37mo || '',
      goal_61mo: prefill.goal_61mo || '',
      invincible: prefill.invincible || '',
      channels: prefill.channels ? prefill.channels.slice() : []
    };
    const STEPS = 4;

    root.innerHTML = `
      <div class="appbar"><div class="wrap">
        <div class="logo"><img src="assets/rate-tracker-logo.jpg" alt="Rate Tracker"></div>
        <div class="right"><span class="who" id="who"></span><button class="linkbtn" id="signout">Sign out</button></div>
      </div></div>
      <div class="wiz">
        <div class="wiz-progress" id="prog"></div>
        <form id="wizForm">

          <div class="wiz-step" data-step="0">
            <div class="stepnum">Step 1 of ${STEPS}</div>
            <h2>Let's start with you</h2>
            <p class="help">We'll personalize your entire plan around this.</p>
            <div class="two">
              <div class="field"><label>First name</label><input type="text" id="first_name" value="${esc(state.first_name)}" required></div>
              <div class="field"><label>Last name</label><input type="text" id="last_name" value="${esc(state.last_name)}" required></div>
            </div>
            <div class="field"><label>Email</label><input type="email" id="email" value="${esc(state.email)}" required></div>
          </div>

          <div class="wiz-step" data-step="1">
            <div class="stepnum">Step 2 of ${STEPS}</div>
            <h2>Your income targets</h2>
            <p class="help">Monthly residual income at each milestone. These drive the math behind your plan.</p>
            <div class="field"><label>What does it cost to cover your monthly living expenses?</label>
              <div class="money-input"><span>$</span><input type="number" id="living_expenses" min="0" step="100" value="${esc(state.living_expenses)}" placeholder="4,000"></div>
              <div class="hint">Used to frame your "financially free" line.</div></div>
            <div class="field"><label>At what monthly residual would you feel financially free?</label>
              <div class="money-input"><span>$</span><input type="number" id="financially_free" min="0" step="100" value="${esc(state.financially_free)}" placeholder="6,000"></div></div>
            <div class="field"><label>Your 13-month monthly residual goal <span class="hint" style="display:inline">(this sets your activity plan)</span></label>
              <div class="money-input"><span>$</span><input type="number" id="goal_13mo" min="0" step="100" value="${esc(state.goal_13mo)}" placeholder="10,000" required></div></div>
            <div class="two">
              <div class="field"><label>37-month goal</label>
                <div class="money-input"><span>$</span><input type="number" id="goal_37mo" min="0" step="100" value="${esc(state.goal_37mo)}" placeholder="30,000"></div></div>
              <div class="field"><label>61-month goal</label>
                <div class="money-input"><span>$</span><input type="number" id="goal_61mo" min="0" step="100" value="${esc(state.goal_61mo)}" placeholder="50,000"></div></div>
            </div>
            <div id="livePreview"></div>
          </div>

          <div class="wiz-step" data-step="2">
            <div class="stepnum">Step 3 of ${STEPS}</div>
            <h2>How do you want to generate leads?</h2>
            <p class="help">Pick the channels you'll actually work. We'll build a playbook for each one you choose.</p>
            <div class="chips" id="chips"></div>
            <div class="wiz-err" id="chipErr"></div>
          </div>

          <div class="wiz-step" data-step="3">
            <div class="stepnum">Step 4 of ${STEPS}</div>
            <h2>The mindset piece</h2>
            <p class="help">One last question. Optional, but it makes your plan personal.</p>
            <div class="field"><label>What would make you feel financially invincible?</label>
              <textarea id="invincible" placeholder="Describe what total financial security looks like for you...">${esc(state.invincible)}</textarea></div>
          </div>

          <div class="wiz-err" id="wizErr"></div>
          <div class="wiz-nav">
            <button type="button" class="btn btn-ghost" id="backBtn">Back</button>
            <button type="button" class="btn" id="nextBtn">Continue</button>
          </div>
        </form>
      </div>`;

    // chips
    const chipsEl = root.querySelector('#chips');
    chipsEl.innerHTML = CHANNEL_OPTS.map(c => {
      const sel = state.channels.includes(c);
      return `<label class="chip ${sel?'sel':''}" data-c="${esc(c)}">
        <input type="checkbox" value="${esc(c)}" ${sel?'checked':''}>${esc(RT.CHANNEL_LABELS[c]||c)}</label>`;
    }).join('');
    chipsEl.querySelectorAll('input').forEach(inp => inp.addEventListener('change', e => {
      const c = e.target.value;
      e.target.closest('.chip').classList.toggle('sel', e.target.checked);
      if (e.target.checked) { if (!state.channels.includes(c)) state.channels.push(c); }
      else state.channels = state.channels.filter(x => x !== c);
    }));

    // bind inputs to state
    ['first_name','last_name','email','living_expenses','financially_free','goal_13mo','goal_37mo','goal_61mo','invincible']
      .forEach(id => {
        const el = root.querySelector('#'+id);
        el.addEventListener('input', () => { state[id] = el.value; if (id.startsWith('goal_13')) updateLive(); });
      });

    // live preview (updates from the 13-month goal)
    function updateLive() {
      const g = +state.goal_13mo || 0;
      const box = root.querySelector('#livePreview');
      if (!g) { box.innerHTML = ''; return; }
      const r = RT.compute(g);
      box.innerHTML = `
        <div class="live">
          <div class="eyebrow">Live preview</div>
          <h3>At ${RT.fmtMoney(g)}/mo, here's your plan shape</h3>
          <div class="live-stats">
            <div class="live-stat"><div class="v">${r.accounts}</div><div class="k">Accounts needed</div></div>
            <div class="live-stat"><div class="v">~${r.perMonth}/mo</div><div class="k">New accounts/month</div></div>
            <div class="live-stat"><div class="v">${r.prospectsLow}\u2013${r.prospectsHigh}</div><div class="k">Prospects/week</div></div>
            <div class="live-stat"><div class="v">${r.tier}</div><div class="k">Your tier</div></div>
          </div>
        </div>`;
    }
    updateLive();

    // navigation
    const prog = root.querySelector('#prog');
    prog.innerHTML = Array.from({length:STEPS}, (_,i)=>`<div class="seg" data-seg="${i}"></div>`).join('');
    const backBtn = root.querySelector('#backBtn');
    const nextBtn = root.querySelector('#nextBtn');

    function showStep() {
      root.querySelectorAll('.wiz-step').forEach(s => s.classList.toggle('active', +s.dataset.step === state.step));
      prog.querySelectorAll('.seg').forEach((s,i) => s.classList.toggle('done', i <= state.step));
      backBtn.style.visibility = state.step === 0 ? 'hidden' : 'visible';
      nextBtn.textContent = state.step === STEPS-1 ? 'Generate my plan' : 'Continue';
      root.querySelector('#wizErr').textContent = '';
      window.scrollTo({top:0,behavior:'smooth'});
    }

    function validate() {
      const err = root.querySelector('#wizErr');
      if (state.step === 0) {
        if (!state.first_name.trim() || !state.last_name.trim() || !state.email.trim()) { err.textContent = 'Please fill in your name and email.'; return false; }
      }
      if (state.step === 1) {
        if (!(+state.goal_13mo > 0)) { err.textContent = 'Please enter your 13-month residual goal. It sets your whole plan.'; return false; }
      }
      if (state.step === 2) {
        if (state.channels.length === 0) { err.textContent = 'Pick at least one lead channel to work.'; return false; }
      }
      return true;
    }

    backBtn.addEventListener('click', () => { if (state.step>0){ state.step--; showStep(); } });
    nextBtn.addEventListener('click', () => {
      if (!validate()) return;
      if (state.step < STEPS-1) { state.step++; showStep(); return; }
      // submit
      onComplete({
        first_name: state.first_name.trim(),
        last_name: state.last_name.trim(),
        email: state.email.trim(),
        living_expenses: state.living_expenses === '' ? null : String(state.living_expenses),
        financially_free: state.financially_free === '' ? null : +state.financially_free,
        goal_13mo: +state.goal_13mo,
        goal_37mo: state.goal_37mo === '' ? null : +state.goal_37mo,
        goal_61mo: state.goal_61mo === '' ? null : +state.goal_61mo,
        invincible: state.invincible.trim() || null,
        channels: state.channels.slice()
      });
    });

    showStep();
    return { setWho: (txt)=>{ const w=root.querySelector('#who'); if(w) w.textContent = txt; },
             onSignout: (fn)=> root.querySelector('#signout').addEventListener('click', fn) };
  }

  return { render };
})();
