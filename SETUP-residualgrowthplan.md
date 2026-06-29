# Residual Growth Plan - Go-Live Guide (residualgrowthplan.com)

Three short steps: put the app on Netlify, point your Namecheap domain at it, then
tell Supabase the new address is allowed. Total time: about 15-20 minutes.

---

## Step 1 - Deploy to Netlify (5 min)

You have the zip file `residualgrowthplan-netlify.zip`. Easiest path is drag-and-drop.

1. Go to https://app.netlify.com and log in.
2. On the "Sites" page, find the drag-and-drop box that says
   "Want to deploy a new site without connecting to Git? Drag and drop your site
   output folder here."
3. Unzip `residualgrowthplan-netlify.zip` on your computer first, then drag the
   UNZIPPED folder (the one containing index.html) into that box.
   - Netlify will not accept the .zip itself for drag-and-drop. Unzip first.
4. Netlify gives you a temporary address like `random-name-123.netlify.app`.
   Open it - you should see the Rate Tracker login screen.

(If you prefer Git: push the unzipped folder to a repo and connect it. The
included `netlify.toml` already sets the publish directory and headers.)

---

## Step 2 - Connect your Namecheap domain (5-10 min)

### 2a. Add the domain in Netlify
1. In your new site: Site configuration > Domain management > Add a domain.
2. Enter `residualgrowthplan.com` and confirm.
3. Netlify will show you DNS records to add. Use the "external DNS" option so you
   keep the domain at Namecheap.

### 2b. Add the records at Namecheap
1. Namecheap > Domain List > Manage (next to residualgrowthplan.com) > Advanced DNS.
2. Add the records Netlify showed you. Typically:
   - An A record for the root: Host `@`, Value `75.2.60.5` (Netlify's load balancer
     IP - use whatever Netlify shows you, it may differ).
   - A CNAME for www: Host `www`, Value `<your-site>.netlify.app`.
3. Save. DNS can take 5 minutes to a few hours to propagate.
4. Back in Netlify, it will auto-issue a free HTTPS certificate once DNS resolves.

When done, https://residualgrowthplan.com loads the login screen.

---

## Step 3 - Allow the domain in Supabase (CRITICAL - 2 min)

The magic-link login will NOT work until you do this. Supabase only sends people
back to web addresses you have approved.

1. Go to https://supabase.com/dashboard and open the project
   "rate-tracker-tech-stack".
2. Left sidebar: Authentication > URL Configuration.
3. Set **Site URL** to:
   ```
   https://residualgrowthplan.com
   ```
4. Under **Redirect URLs**, click "Add URL" and add BOTH of these:
   ```
   https://residualgrowthplan.com/**
   https://www.residualgrowthplan.com/**
   ```
   (The `/**` wildcard lets the link return people to app.html and admin.html.)
5. Click Save.

That's it. Test it: open https://residualgrowthplan.com, enter your email, click
the link in your inbox, and you should land in the intake wizard.

---

## Notes

- **You are seeded as admin.** brendan@ratetracker.io is already an admin, so after
  you log in you'll see an "Admin dashboard" link on your plan to view all partners.
- **Any partner email can sign up** (open self-serve), per your choice.
- **PDF**: partners click "Download as PDF" on their plan, which opens the browser
  print dialog set to a clean print layout - they save as PDF from there.
- **The new-plan email to you** is already wired into the database. Every time a
  partner finishes their plan, you'll get an email. It uses Web3Forms (which you
  already use), so there's one tiny one-time step below to turn it on.
  The dashboard already shows every submission live regardless.

---

## Optional Step 4 - Turn on the "new plan" email (2 min)

The database is already set to email you on every new submission. It just needs
your Web3Forms access key (stored securely, never in the website code).

1. Go to https://web3forms.com, enter your email (brendan@ratetracker.io), and
   copy the Access Key they send/show you. (Free; you may already have one.)
2. In the Supabase dashboard for "rate-tracker-tech-stack", open the SQL Editor
   and run this once, pasting your key where shown:
   ```sql
   select vault.create_secret('YOUR-WEB3FORMS-ACCESS-KEY', 'web3forms_key');
   ```
3. Done. The next plan submitted will email you automatically.

   To update the key later, run:
   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'web3forms_key'),
     'NEW-KEY'
   );
   ```

If you'd rather just send Computer the Web3Forms key, it can set this up for you.
- **config.js** holds the Supabase public key - this is safe to expose; your data
  is protected by row-level security rules.
