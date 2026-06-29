/* ==========================================================================
   Rate Tracker - shared auth + Supabase client helpers
   Requires: config.js and @supabase/supabase-js (UMD) loaded before this.
   ========================================================================== */
window.RTAuth = (function () {
  const { SUPABASE_URL, SUPABASE_KEY } = window.RT_CONFIG;
  // Implicit flow (token in URL hash). More forgiving than PKCE for email magic
  // links: it works even when the link is opened in a different browser or an
  // email client's in-app browser, because there is no device-bound code verifier.
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, flowType: 'implicit' }
  });

  // Wait for Supabase to finish processing any auth tokens in the URL, then
  // return the current user (or null). Resolves quickly once the session is set.
  async function getUser() {
    // Give detectSessionInUrl a moment if we just landed from a magic link.
    const hasAuthInUrl = /[#&](access_token|error|code)=/.test(window.location.hash) ||
                         /[?&](code|error)=/.test(window.location.search);
    let { data: { session } } = await sb.auth.getSession();
    if (!session && hasAuthInUrl) {
      // Wait briefly for onAuthStateChange to fire after URL token processing.
      session = await new Promise((resolve) => {
        let done = false;
        const finish = (s) => { if (!done) { done = true; resolve(s); } };
        const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
          if (s) { sub.subscription.unsubscribe(); finish(s); }
        });
        // Poll as a backup, and time out after 6s so we never hang forever.
        const started = Date.now();
        const poll = setInterval(async () => {
          const r = await sb.auth.getSession();
          if (r.data.session) { clearInterval(poll); sub.subscription.unsubscribe(); finish(r.data.session); }
          else if (Date.now() - started > 6000) { clearInterval(poll); sub.subscription.unsubscribe(); finish(null); }
        }, 300);
      });
    }
    return session ? session.user : null;
  }

  // Send a magic link. redirectTo brings them back to the app after they click.
  async function sendMagicLink(email, redirectTo) {
    return sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
    });
  }

  async function signOut() { await sb.auth.signOut(); }

  // Is the current user an admin? (reads gp_admins via RLS)
  async function isAdmin() {
    const { data, error } = await sb.rpc('gp_is_admin');
    if (error) return false;
    return !!data;
  }

  return { sb, getUser, sendMagicLink, signOut, isAdmin };
})();
