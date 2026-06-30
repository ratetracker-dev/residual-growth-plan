/* ==========================================================================
   Rate Tracker - Dynamic Report Renderer
   Takes a plan record (the partner's answers + computed plan) and renders the
   full branded report, matching the approved sample. Reuses the same widget,
   chart, and milestone logic.
   ========================================================================== */
window.RTReport = (function () {
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  const today = () => new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

  function render(root, plan, opts) {
    opts = opts || {};
    const r = RT.compute(plan.goal_13mo);
    const first = plan.first_name || 'there';
    const free = +plan.financially_free || 0;
    const g13 = +plan.goal_13mo || 0;
    const g37 = +plan.goal_37mo || 0;
    const g61 = +plan.goal_61mo || 0;
    const invAmt = g61 ? g61 * 2 : g13 * 4; // "invincible" stretch beyond 61mo
    const channels = (plan.channels || []);

    // milestones for chart + timeline (only those provided)
    const milestones = [];
    if (free) milestones.push({ when:'Free', amt:free });
    milestones.push({ when:'13 Months', amt:g13 });
    if (g37) milestones.push({ when:'37 Months', amt:g37 });
    if (g61) milestones.push({ when:'61 Months', amt:g61 });
    milestones.push({ when:'Invincible', amt:invAmt });

    const tsLabels = ['Today', ...milestones.map(m=>m.when==='13 Months'?'Mo 13':m.when==='37 Months'?'Mo 37':m.when==='61 Months'?'Mo 61':m.when)];
    const tsData = [0, ...milestones.map(m=>m.amt)];

    // presets for widget = the partner's own milestones
    const presets = [];
    if (free) presets.push({v:free, label:`Financially free \u00b7 ${RT.fmtK(free)}`});
    presets.push({v:g13, label:`13-mo goal \u00b7 ${RT.fmtK(g13)}`});
    if (g37) presets.push({v:g37, label:`37-mo goal \u00b7 ${RT.fmtK(g37)}`});
    if (g61) presets.push({v:g61, label:`61-mo goal \u00b7 ${RT.fmtK(g61)}`});
    presets.push({v:invAmt, label:`Invincible \u00b7 ${RT.fmtK(invAmt)}`});

    const channelCards = channels.map((c,i) => {
      const label = RT.CHANNEL_LABELS[c] || c;
      const tactic = RT.CHANNELS[c] || '';
      const full = (i === channels.length-1 && channels.length % 2 === 1) ? ' style="grid-column:1/-1"' : '';
      return `<div class="channel"${full}><h4><span class="dot"></span>${esc(label)}</h4><p>${esc(tactic)}</p></div>`;
    }).join('');

    const adminBtn = opts.isAdmin ? `<a class="linkbtn" href="admin.html">Admin dashboard</a>` : '';

    // ---- Referral / affiliate card (feature-flagged) ----
    const refEnabled = !!(window.RTReferral && RTReferral.enabled);
    const refCode = opts.refCode || null;
    const refLink = refEnabled && refCode ? RTReferral.shareLink(refCode) : '';
    const shareMsg = 'I just mapped out my residual growth plan with this free tool from Rate Tracker. Thought of you, take a look:';
    const referralCard = (refEnabled && refLink) ? `
        <section class="refer-card no-print">
          <div class="eyebrow">Know someone great in the industry?</div>
          <h2>Pass this opportunity along</h2>
          <p>Have friends or colleagues in payments you think we would be a great fit to partner with? Share your personal link below. And when you partner with Rate Tracker yourself, you unlock the ability to earn on every new partner you bring to us. Help us grow, and grow right alongside them.</p>
          <div class="refer-linkrow">
            <input type="text" id="refLink" readonly value="${esc(refLink)}" aria-label="Your personal share link">
            <button class="refer-copy" id="refCopy" type="button">Copy link</button>
          </div>
          <div class="refer-share">
            <a class="refer-btn" id="refEmail" href="mailto:?subject=${encodeURIComponent('A tool I think you should see')}&body=${encodeURIComponent(shareMsg + ' ' + refLink)}">Email</a>
            <a class="refer-btn" id="refSms" href="sms:?&body=${encodeURIComponent(shareMsg + ' ' + refLink)}">Text</a>
            <a class="refer-btn" id="refLi" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(refLink)}" target="_blank" rel="noopener">LinkedIn</a>
            <a class="refer-btn" id="refFb" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}" target="_blank" rel="noopener">Facebook</a>
          </div>
          <div class="refer-learn-row">
            <a class="btn refer-learn" href="https://growmyresidual.com/#cta" target="_blank" rel="noopener">Become a partner and apply now</a>
            <a class="btn refer-cal" href="https://meetings.hubspot.com/brendan236?uuid=af2f3c65-0f26-426e-8b24-11496093c9ef" target="_blank" rel="noopener">Book a conversation</a>
          </div>
          <p class="refer-learn-note">The apply button takes you straight to the form, no need to read the whole page. Fill it out and we will reach out, or grab a time that works best for you on the calendar.</p>
        </section>` : '';

    root.innerHTML = `
      <div class="appbar no-print"><div class="wrap">
        <div class="brandgroup">
          <div class="logo"><img src="assets/rate-tracker-logo.jpg" alt="Rate Tracker"></div>
          <div class="brandtag"><span class="bt-name">Residual Growth Plan</span><span class="bt-sub">Powered by Rate Tracker</span></div>
        </div>
        <div class="right">
          ${adminBtn}
          <button class="linkbtn" id="editPlan">Edit my answers</button>
          <button class="linkbtn" id="signout">Sign out</button>
        </div>
      </div></div>

      <div class="r-hero">
        <div class="wrap">
          <div class="r-brandrow">
            <div class="logo print-only"><img src="assets/rate-tracker-logo.jpg" alt="Rate Tracker"></div>
            <button class="toggle" data-theme-toggle aria-label="Toggle dark mode">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
          </div>
          <div class="eyebrow" style="color:var(--rt-green)">Residual Growth Plan \u00b7 Prepared ${today()}</div>
          <h1>Your roadmap to <span class="hl">financial freedom</span>, ${esc(first)}.</h1>
          <p class="sub">A customized plan built from your income goals, with the exact weekly activity it takes to get there. This isn't about working harder. It's about working smarter.</p>
          <span class="tierbadge">\u25c6 ${esc(r.tier.toUpperCase())} TIER \u00b7 ${RT.fmtK(g13)} target in 13 months</span>
          <div class="r-meta">
            ${free?`<div><span>Financially free at</span><b>${RT.fmtMoney(free)}/mo</b></div>`:''}
            <div><span>13-month goal</span><b>${RT.fmtMoney(g13)}/mo</b></div>
            ${g61?`<div><span>61-month goal</span><b>${RT.fmtMoney(g61)}/mo</b></div>`:''}
            <div><span>Lead channels chosen</span><b>${channels.length} of 7</b></div>
          </div>
        </div>
      </div>

      <div class="wrap">
        <div class="kpis">
          <div class="kpi"><div class="n">~${r.perMonth}/mo</div><div class="l">New accounts to sign to stay on pace</div></div>
          <div class="kpi"><div class="n">${r.prospectsLow}\u2013${r.prospectsHigh}</div><div class="l">Qualified prospects to source weekly</div></div>
          <div class="kpi"><div class="n">${r.accounts}</div><div class="l">Active accounts that fund your 13-mo goal</div></div>
          <div class="kpi"><div class="n">${r.hotList}</div><div class="l">Merchants to keep on your hot list</div></div>
        </div>
      </div>

      <div class="wrap">
        <section>
          <div class="objective">
            <div class="eyebrow">Objective</div>
            <p class="lead" style="margin-top:.6rem">Support you, <b>${esc(first)}</b>, in growing your monthly residual income over the next 12 months${g37||g61?`, while keeping you on track for ${g37?`<b>${RT.fmtMoney(g37)} in 37 months</b>`:''}${g37&&g61?' and ':''}${g61?`<b>${RT.fmtMoney(g61)} in 61 months</b>`:''}`:''}. This plan focuses on structured activity, strong lead generation, and accountability from a team you can tap into at any time.</p>
          </div>
        </section>

        <section>
          <div class="rev">
            <div class="eyebrow">Try It Yourself</div>
            <h2>Reverse-engineer your residual</h2>
            <p class="rev-sub">Drag the slider to set any monthly residual goal. Watch in real time how many merchant accounts it takes, and exactly what your prospecting needs to look like to get there.</p>
            <div class="rev-grid">
              <div>
                <div class="rev-label">My monthly residual goal</div>
                <div class="rev-amount"><span id="revAmount">${RT.fmtMoney(g13)}</span><span class="per">/mo</span></div>
                <div class="slider-wrap">
                  <input type="range" class="rev-slider" id="revSlider" min="1000" max="100000" step="500" value="${Math.min(100000,Math.max(1000,g13))}" aria-label="Monthly residual goal">
                  <div class="slider-scale"><span>$1K</span><span>$25K</span><span>$50K</span><span>$75K</span><span>$100K</span></div>
                </div>
                <div class="preset-row" id="presetRow">
                  ${presets.map(p=>`<button type="button" class="preset ${p.v===g13?'active':''}" data-v="${p.v}">${esc(p.label)}</button>`).join('')}
                </div>
              </div>
              <div class="dial-wrap">
                <div class="dial">
                  <svg width="230" height="230" viewBox="0 0 230 230">
                    <circle cx="115" cy="115" r="100" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="16"/>
                    <circle id="dialArc" cx="115" cy="115" r="100" fill="none" stroke="#45B72E" stroke-width="16" stroke-linecap="round" stroke-dasharray="628" stroke-dashoffset="209"/>
                  </svg>
                  <div class="center"><div class="big" id="dialAccounts">${r.accounts}</div><div class="cap">Accounts needed</div></div>
                </div>
              </div>
            </div>
            <div class="rev-stats">
              <div class="rev-stat"><div class="v" id="revPerMonth">~${r.perMonth}/mo</div><div class="k">New accounts to sign each month (to hit it in 13 months)</div></div>
              <div class="rev-stat"><div class="v" id="revProspects">${r.prospectsLow}\u2013${r.prospectsHigh}</div><div class="k">Qualified prospects to source weekly</div></div>
              <div class="rev-stat"><div class="v" id="revTier">${esc(r.tier)}</div><div class="k">Your activity tier at this goal</div></div>
            </div>
          </div>
        </section>

        <section>
          <div class="section-head"><div class="eyebrow">The Math Behind Your Goals</div><h2>Where your residual is headed</h2></div>
          <div class="card">
            <div class="chartwrap"><canvas id="growthChart"></canvas></div>
            <p class="chart-note">Projection assumes ~$150/month residual per active merchant account. Your milestones translate directly into accounts under management.</p>
            <div class="timeline">
              ${milestones.map(m=>`<div class="ms"><div class="when">${esc(m.when)}</div><div class="amt">${RT.fmtK(m.amt)}</div><div class="acc">${RT.accountsFor(m.amt)} accounts</div></div>`).join('')}
            </div>
          </div>
        </section>

        <section>
          <div class="section-head"><div class="eyebrow">Your Personalized Cadence</div><h2>Weekly activity plan</h2></div>
          <div class="card" style="padding:var(--space-4) var(--space-6);overflow-x:auto">
            <table class="activity" style="min-width:480px">
              <thead><tr><th>Activity</th><th>Your weekly target</th><th>Why this number</th></tr></thead>
              <tbody>
                <tr><td class="act">New qualified prospects</td><td class="plan">${r.prospectsLow}\u2013${r.prospectsHigh}</td><td class="note">At a 1-in-5 close rate, this is what feeds ~${r.perMonth} new accounts/month</td></tr>
                <tr><td class="act">New accounts signed</td><td class="plan">~${r.perMonth}/mo</td><td class="note">Keeps you on pace for ${r.accounts} accounts by month 13</td></tr>
                <tr><td class="act">Social media posts</td><td class="plan">${r.socialLow}\u2013${r.socialHigh}</td><td class="note">80% lifestyle / 20% sales mix</td></tr>
                <tr><td class="act">Follow-ups / check-ins</td><td class="plan">${r.followupsLow}\u2013${r.followupsHigh}</td><td class="note">Build a warm, compounding pipeline</td></tr>
                <tr><td class="act">Referral-partner touches</td><td class="plan">${r.rpLow}\u2013${r.rpHigh}</td><td class="note">CPAs, B2B reps, accounting firms</td></tr>
                <tr><td class="act">Accountability check-in</td><td class="plan">1</td><td class="note">Short, simple, focused, with your Sales Director</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        ${channels.length?`<section>
          <div class="section-head"><div class="eyebrow">Your ${channels.length} Selected Lead Channel${channels.length>1?'s':''}</div><h2>How to work each lane</h2></div>
          <div class="channel-grid">${channelCards}</div>
        </section>`:''}

        <section>
          <div class="section-head"><div class="eyebrow">Strategic Focus Areas</div><h2>Three habits that compound</h2></div>
          <div class="cols">
            <div class="focus"><h4>A \u00b7 Consistent prospecting</h4><ul>
              <li>Hit your weekly prospecting target of ${r.prospectsLow}\u2013${r.prospectsHigh} new conversations.</li>
              <li>Pick 2\u20133 industries you enjoy and specialize. Sell on technology, not rates.</li>
              <li>Block two hours of prospecting at the same time every day.</li>
            </ul></div>
            <div class="focus"><h4>B \u00b7 Weekly visibility</h4><ul>
              <li>Post ${r.socialLow}\u2013${r.socialHigh} times a week. Start where it's manageable.</li>
              <li>Keep an 80% life / 20% sales content mix.</li>
              <li>Add light CTAs: "If you've experienced this, reach out."</li>
            </ul></div>
            <div class="focus" style="grid-column:1/-1"><h4>C \u00b7 Follow-up rhythm &amp; pipeline tracking</h4><ul>
              <li>Keep a hot list of ${r.hotList} dream merchants: high volume, dual pricing, growing owners.</li>
              <li>Use your CRM to track every conversation, reminder, and next step.</li>
              <li>Input daily prospecting data so you can sort great opportunities from the rest.</li>
            </ul></div>
          </div>
        </section>

        <section>
          <div class="support">
            <div class="eyebrow">Accountability &amp; Mentorship</div>
            <h2>You're not doing this alone</h2>
            <p>Every Rate Tracker Sales Partner is paired with a Sales Director who's incentivized to grow your residual. Think personal trainer for your income. The lack of accountability is what sinks most 1099 agents, so we invest heavily here and recruit quality over quantity.</p>
            <p style="color:#fff;font-weight:600">Your Friday check-in (10\u201320 min): wins from the week \u2192 new conversations logged \u2192 opportunities created \u2192 priority for next week.</p>
            <div class="score-box">
              <p style="margin:0"><b>Bonus income engine:</b> We also offer business funding for merchants, powered by our free <b>Score</b> software that helps owners understand and optimize their cash flow. Funding deals pay upfront commissions, a great complement to your residual.</p>
            </div>
          </div>
        </section>

        <section class="mindset">
          <div class="eyebrow">The Invincible Mindset</div>
          <h2>Consistent activity over time <span class="hl">compounds fast.</span></h2>
          <p>You've already built a strong foundation, ${esc(first)}. This plan isn't about working harder. It's about working smarter, generating more leads, and onboarding the best clients you can find. A plan removes the emotion and doubt from prospecting. Build a strong pipeline and nothing can stop you. Your residual will grow as big as you want it to.</p>
          <button class="btn no-print" id="downloadPdf" style="margin-top:var(--space-8)">\u2193 Download my plan (PDF)</button>
        </section>

        ${referralCard}

        <section class="partner-cta no-print">
          <div class="eyebrow">Want a team behind your plan?</div>
          <h2>Ready to grow your residual for real?</h2>
          <p>This plan is yours to keep, free. If you want the tools, support, and economics to build a serious residual portfolio, see what partnering looks like.</p>
          <a class="btn" href="https://growmyresidual.com" target="_blank" rel="noopener">Become a partner</a>
        </section>
      </div>

      <footer>
        <span>Rate Tracker \u00b7 Payments \u00b7 Capital \u00b7 Profit</span>
        <span>7100 E Pleasant Valley Rd, Suite 280, Independence, OH 44131 \u00b7 ratetracker.io</span>
      </footer>`;

    // ---- theme toggle ----
    (function(){
      const t=root.querySelector('[data-theme-toggle]'),el=document.documentElement;
      let d=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
      el.setAttribute('data-theme',d);
      t&&t.addEventListener('click',()=>{d=d==='dark'?'light':'dark';el.setAttribute('data-theme',d);drawChart();});
    })();

    // ---- chart ----
    let chart;
    function drawChart(){
      const css=getComputedStyle(document.documentElement);
      const green=css.getPropertyValue('--rt-green').trim();
      const grid=css.getPropertyValue('--border').trim();
      const text=css.getPropertyValue('--text-muted').trim();
      const ctx=root.querySelector('#growthChart'); if(!ctx) return;
      if(chart)chart.destroy();
      chart=new Chart(ctx,{type:'line',
        data:{labels:tsLabels,datasets:[{label:'Monthly Residual',data:tsData,
          borderColor:green,backgroundColor:'rgba(69,183,46,.12)',fill:true,tension:.35,
          borderWidth:3,pointRadius:5,pointBackgroundColor:green,pointBorderColor:'#fff',pointBorderWidth:2}]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>'$'+c.parsed.y.toLocaleString()+'/mo'}}},
          scales:{y:{grid:{color:grid},ticks:{color:text,callback:v=>'$'+(v/1000)+'K'}},x:{grid:{display:false},ticks:{color:text}}}}});
    }
    drawChart();

    // ---- reverse-engineer widget ----
    (function(){
      const CIRC=628;
      const slider=root.querySelector('#revSlider'),amtEl=root.querySelector('#revAmount'),
        accEl=root.querySelector('#dialAccounts'),arc=root.querySelector('#dialArc'),
        perMo=root.querySelector('#revPerMonth'),prosEl=root.querySelector('#revProspects'),
        tierEl=root.querySelector('#revTier'),presetsEls=root.querySelectorAll('.preset');
      let curAcc=r.accounts;
      function renderW(goal,animate){
        const c=RT.compute(goal);
        amtEl.textContent=RT.fmtMoney(goal);
        perMo.textContent='~'+c.perMonth+'/mo';
        prosEl.textContent=c.prospectsLow+'\u2013'+c.prospectsHigh;
        tierEl.textContent=c.tier;
        const frac=Math.min(1,c.accounts/667);
        arc.style.transition=animate?'stroke-dashoffset .5s cubic-bezier(.22,1,.36,1)':'none';
        arc.style.strokeDashoffset=CIRC-(CIRC*frac);
        const target=c.accounts;
        if(!animate){accEl.textContent=target;curAcc=target;return;}
        const start=curAcc,diff=target-start,dur=450,t0=performance.now();
        (function step(now){const p=Math.min(1,(now-t0)/dur);const e=1-Math.pow(1-p,3);
          accEl.textContent=Math.round(start+diff*e);if(p<1)requestAnimationFrame(step);else curAcc=target;})(performance.now());
      }
      slider.addEventListener('input',e=>{const v=+e.target.value;renderW(v,true);
        presetsEls.forEach(p=>p.classList.toggle('active',+p.dataset.v===v));});
      presetsEls.forEach(p=>p.addEventListener('click',()=>{const v=+p.dataset.v;slider.value=Math.min(100000,Math.max(1000,v));renderW(v,true);
        presetsEls.forEach(x=>x.classList.toggle('active',x===p));}));
      renderW(g13,false);
    })();

    // ---- actions ----
    root.querySelector('#downloadPdf').addEventListener('click',()=>window.print());
    if(opts.onEdit) root.querySelector('#editPlan').addEventListener('click',opts.onEdit);
    if(opts.onSignout) root.querySelector('#signout').addEventListener('click',opts.onSignout);

    // ---- referral card actions ----
    (function(){
      const copyBtn = root.querySelector('#refCopy'), linkEl = root.querySelector('#refLink');
      if(copyBtn && linkEl){
        copyBtn.addEventListener('click',()=>{
          const val = linkEl.value;
          const done = ()=>{ const t=copyBtn.textContent; copyBtn.textContent='Copied'; setTimeout(()=>copyBtn.textContent=t,1400); };
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(val).then(done).catch(()=>{ linkEl.select(); document.execCommand('copy'); done(); });
          } else { linkEl.select(); document.execCommand('copy'); done(); }
          if(window.RTA) RTA.track('referral_link_copied', { ref: (opts.refCode||'') });
        });
      }
      root.querySelectorAll('.refer-btn').forEach(b => b.addEventListener('click', ()=>{
        if(window.RTA) RTA.track('referral_share_clicked', { channel: b.id.replace('ref','').toLowerCase(), ref: (opts.refCode||'') });
      }));
      const learnBtn = root.querySelector('.refer-learn');
      if(learnBtn) learnBtn.addEventListener('click', ()=>{ if(window.RTA) RTA.track('referral_apply_click', { ref: (opts.refCode||'') }); });
      const calBtn = root.querySelector('.refer-cal');
      if(calBtn) calBtn.addEventListener('click', ()=>{ if(window.RTA) RTA.track('referral_calendar_click', { ref: (opts.refCode||'') }); });
    })();
  }

  return { render };
})();
