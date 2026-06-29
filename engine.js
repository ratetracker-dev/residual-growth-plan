/* ==========================================================================
   Rate Tracker - Smart Suggestion Engine (single source of truth)
   Used by the intake wizard preview AND the dynamic report.
   Mirrors engine-spec.md exactly.
   ========================================================================== */
window.RT = (function () {
  const RES_PER_ACCT = 150;   // $/merchant/month (Rate Tracker portfolio economics)
  const CLOSE = 0.20;         // 1 in 5 qualified prospects closes
  const WEEKS = 4.3;          // working weeks per month
  const HORIZON = 13;         // months to the 13-month goal
  const ceil = Math.ceil, max = Math.max;

  // Tier the partner by their 13-month goal so volume scales with ambition
  function tierFor(goal) {
    if (goal < 5000)  return { name: 'Builder',  floor: 8,  social: [3, 5],  followups: [12, 15], rp: [1, 1] };
    if (goal < 15000) return { name: 'Closer',   floor: 12, social: [5, 7],  followups: [18, 22], rp: [1, 2] };
    if (goal < 30000) return { name: 'Operator', floor: 18, social: [5, 7],  followups: [22, 28], rp: [2, 2] };
    return                   { name: 'Empire',   floor: 25, social: [7, 10], followups: [28, 35], rp: [2, 3] };
  }

  function accountsFor(goal) { return ceil((goal || 0) / RES_PER_ACCT); }

  // Core computation for a given 13-month goal
  function compute(goal13) {
    goal13 = Math.max(0, +goal13 || 0);
    const t = tierFor(goal13);
    const accounts = accountsFor(goal13);
    const perMonth = max(1, ceil(accounts / HORIZON));
    const perWeekAccounts = perMonth / WEEKS;
    const engineProspects = ceil(perWeekAccounts / CLOSE);
    const pLow = max(t.floor, engineProspects);
    const pHigh = pLow + 4;
    const hotList = max(20, pLow * 2);
    return {
      tier: t.name,
      accounts,                       // accounts that fund the 13-mo goal
      perMonth,                       // new accounts/month
      prospectsLow: pLow,
      prospectsHigh: pHigh,
      socialLow: t.social[0], socialHigh: t.social[1],
      followupsLow: t.followups[0], followupsHigh: t.followups[1],
      rpLow: t.rp[0], rpHigh: t.rp[1],
      hotList
    };
  }

  // Channel tactic copy (only render the ones the partner selected).
  // Keys match the 7 HubSpot checkbox values.
  const CHANNELS = {
    'Door Knocking': 'Map a tight territory and walk 20 businesses/day. Hit decision-maker hours (before 11am, after 2pm), leave a one-page leave-behind, and log every no-answer for a re-visit.',
    'Cold Calling': 'Two power-hour blocks daily against a 40\u201360 list. Lead with dual pricing and technology, not rates. Book the appointment, not the sale, and log every dial.',
    'Paid Advertisements': 'Start with one channel (direct mail or social ads). Track cost-per-appointment, retarget warm traffic, and sponsor one local event per quarter.',
    'Referral From Existing Clients': 'Ask at the 30-day "wow" moment and build a referral ask into every review. Target one ask per active client each quarter and thank generously.',
    'Organic Social Media': '5\u20137 posts/week at consistent times, 80/20 life-to-sales. Document merchant wins, add a soft CTA, and DM everyone who engages.',
    'Networking Events': 'Commit to one BNI/chamber group and one event/week. Have five real conversations per event, follow up within 24 hours, and become the payments person in the room.',
    'Referral Partners': 'Build 3\u20135 CPA/B2B partnerships, deliver a monthly value touch, co-host a lunch, and set a clear referral-fee agreement. Treat partners like your best clients.'
  };
  const CHANNEL_LABELS = {
    'Referral From Existing Clients': 'Referrals From Clients'  // display alias
  };

  const fmtMoney = n => '$' + Math.round(+n || 0).toLocaleString();
  const fmtK = n => { n = +n || 0; return n >= 1000 ? '$' + (n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K' : '$' + n; };

  return {
    RES_PER_ACCT, CLOSE, WEEKS, HORIZON,
    tierFor, accountsFor, compute, CHANNELS, CHANNEL_LABELS, fmtMoney, fmtK
  };
})();
