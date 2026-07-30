# 📈 YouTube Channel Predictor & Tracker

A free, no-login website to **track your YouTube stats over time** and **predict** subscribers, views, watch hours, revenue, and monetization — with plain-English probabilities like *"~72% chance of hitting 1,000 subs by Oct 15."*

Everything runs in your browser. **No account needed, no API keys.** You type your numbers in; it does the math and draws the graphs. If you want your data on more than one device, there's an [optional sign-in](#️-sync-across-devices-optional) — off by default.

---

## ✨ What it does

- **Daily Log** — type in your channel totals whenever you check them (with Edit ✎ / Delete ✕ on every row).
- **Videos** — track individual videos over time (Shorts and long-form kept separate, each with the stats that actually apply to it) and **copy any number of them as pasteable text**.
- **Predict** — opens on a **chart of your future**, no form-filling: pick 1 month / 3 / 6 / 1 year and see where you land. Add a target only if you want the odds of hitting it.
- **Goals** — auto ETAs for every milestone (1k → 1M), a monetization + revenue forecast, and a **what-if** compare chart.
- **Charts** — trend lines for every metric + a Shorts-vs-long-form revenue split.
- **Backup** — export/import JSON (full backup), export CSV, and **import CSV** to bulk-load history from a spreadsheet.
- **Sync** *(optional)* — sign in and your data follows you between phone and PC, merging rather than overwriting. Off unless you set it up.

### Insights & goal tracking
- **Goals for any metric** (Goals tab) — set targets for subscribers, long-form views, watch hours, Shorts engaged views, or **monthly revenue ($)**. Each shows a progress bar, a projected date, and an on-track / behind verdict.
- **"Am I on track?" banner** (Dashboard) — features your main goal and tells you live whether you're on pace, the daily rate you need, and how likely you are to make it.
- **Best time & day to post** (Videos tab) — since you log each video's upload time, it averages performance by weekday and time-of-day and tells you when your posts do best.
- **Video leaderboard** (Videos tab) — ranks your videos by views, views/day, engagement %, **subscribers gained**, **subs per 1,000 views**, **% of the video watched**, **average view duration**, or (for Shorts) **stayed-to-watch %** and **engaged views**.

### Growth models (because growth is never a flat line)
On the **Predict** tab, choose how you think your channel grows:
- **🤖 Smart** — reads your recent pace and its momentum straight from your logs. This is the default and needs nothing typed.
- **📈 Compounding %** — a snowball (e.g. +5%/week); the curve bends upward over time.
- **🎯 Best / likely / worst** — enter three daily rates; get a probability across the whole range.
- **➖ Steady average** — a flat per-day number.
- **🎬 From posting frequency** — "X uploads/week × Y gained per upload."

When you have logs, the manual models are **pre-filled with smart suggestions** from your own recent trend, so you're never starting from a blank guess.

---

## 🚀 Quick start (try it right now)

1. Open the project folder.
2. **Double-click `index.html`.** It opens in your browser with sample data already loaded so you can click around.

> The first load needs internet once (to fetch the charts library from a CDN). After that most things work offline.

---

## 🌐 Put it online for free with GitHub Pages

This gives you a real link (e.g. `https://yourname.github.io/youtube-predictor`) you can open from your phone or laptop.

1. **Make a GitHub account** at [github.com](https://github.com) (free) if you don't have one.
2. Click the **+** (top-right) → **New repository**.
   - Name it something like `youtube-predictor`.
   - Set it to **Public**, then **Create repository**.
3. On the new repo page, click **"uploading an existing file"**.
4. Drag **all these files and folders** into the upload box, keeping the structure:
   ```
   index.html
   README.md
   css/styles.css
   js/  (all the .js files)
   data/sample.js
   sql/setup.sql   (only needed if you want device sync)
   ```
5. Click **Commit changes**.
6. Go to **Settings → Pages** (left sidebar).
7. Under **Build and deployment → Source**, choose **Deploy from a branch**.
8. Pick branch **`main`** and folder **`/ (root)`**, then **Save**.
9. Wait ~1 minute, refresh the page, and GitHub shows your live link at the top. Open it — that's your website. 🎉

To update it later: edit a file on your PC → upload it again to the repo (it replaces the old one). The site refreshes automatically.

---

## 🧭 How to use it

### 1. Daily Log
Add a **snapshot** each time you check your stats. Fill in what you know — blank fields are treated as 0.
- **Total subscribers** — your current sub count.
- **Long-form views / Watch hours** — your regular videos. Watch hours count toward the 4,000-hour monetization path.
- **Shorts views (90 days)** — counts toward the 10-million-views monetization path.
- **RPMs** — how much you earn per 1,000 views (used only to estimate revenue). Leave the defaults if unsure.

The more snapshots you add, the smarter the predictions get. Adding a snapshot with a date you already used **overwrites** that day.

### 2. Videos
**One row per video, two lines each** — title and type on top, then the three numbers that matter for that type. Nothing else competes for your attention: the description, the full history and the rest of the stats live in the panel you get by **clicking the row**. The add-video form, *Best time to post* and the *Leaderboard* stay folded away until you want them.

Add each video with a **title**, **type** (Long or Short), **length**, **publish date + upload time**, and a short **description** (so you remember what it was). Clicking a row opens the log panel: a strip of tiles with everything you've recorded, then a short form to add today's reading, and it tells you the growth since last time (e.g. "+1,500 views since Jul 10 (150/day)").

**The form asks for different stats depending on the type**, because Shorts and long-form aren't measured the same way:

| Stat | Long | Short | Where to find it in YouTube Studio |
|---|:--:|:--:|---|
| Total views | ✅ | ✅ | the video's row / overview |
| **Subscribers gained** | ✅ | ✅ | the video's own analytics — how many subs *this* video brought in |
| Likes, comments | ✅ | ✅ | overview |
| **Video length** | ✅ | ✅ | saved on the video itself, so the app can show what **share of it** people watch |
| **Average view duration** | ✅ | ✅ | Analytics → Engagement — type it as `4:32` (or `0:18` for a Short), or just seconds |
| **Watch hours** | ✅ | — | Analytics → Overview. Meaningless for Shorts, so it isn't asked for. Leave it blank on long-form and it's worked out for you from views × average view duration |
| **Engaged views** | — | ✅ | the Short's monetization card — the strict count that actually goes toward the 3M/10M thresholds, **not** the public view number |
| **Stayed to watch %** | — | ✅ | the Short's retention card — the share who didn't swipe away in the first seconds. The best early signal of whether a Short will get pushed |

Give a video its **length** and you also get **"% of the video watched"** (average view duration ÷ length) everywhere — in the tiles, the row, the leaderboard and the copied report. You can fill a length in later; it's a field in the log panel, not something you have to get right when you add the video.

Shorts are tracked separately and never mixed into long-form watch hours.

#### 📋 Copy stats (for pasting anywhere, including into an AI)
Tick the checkbox on **as many videos as you want** — one, two, or all of them — then hit **📋 Copy stats**. (Tick nothing and it copies them all; each video also has its own **📋 Copy** button for just that one.) It goes straight to your clipboard, so you can `Ctrl+V` it into a note, a doc, a message, or a chat with an AI. The panel that opens keeps the text on screen too, in case your browser blocks clipboard access on `file://`.

Each video comes out as labelled lines — plain enough for a person to skim, structured enough for an AI to parse without guessing:

```
### Video 1 of 2: 60-second pro tip #1
Type: Short (vertical, <3 min)
Length: 0:42 (42s)
Uploaded: 2026-06-01 at 12:30 (59 days ago)
Description: Quick Shorts tip on hooking viewers in the first 3 seconds.
Stats as of 2026-07-29:
- Views: 700,000
- Engaged views: 381,000 (54% of public views)
- Views per day since upload: 13,429
- Subscribers gained: 2,400 (3.43 per 1,000 views)
- Likes: 43,000 (6.14% of views)
- Comments: 1,700 (0.24% of views)
- Average view duration: 0:19 (19s) — 42% of the video
- Stayed to watch: 73%
- Recent growth: +80,000 views between 2026-07-22 and 2026-07-29 (11,429/day)
History (5 readings):
  date | views | engaged views | subs gained | likes | comments | avg view duration | stayed to watch
  2026-06-10 | 42000 | 21000 | 130 | 3100 | 180 | 0:14 | 61%
  ...
```

The report opens with a short legend explaining engaged views, stayed-to-watch and watch hours, so whoever (or whatever) reads it doesn't misinterpret the numbers.

### 3. Predict
**You don't have to type anything.** Open the tab and it already shows where you're heading:

- Pick a horizon — **1 month, 3 months, 6 months, 1 year**, or type your own date.
- A headline in words: *"By Oct 28, 2026 you're heading for 1,059 subscribers"*, with the likely range and your current per-day pace.
- A **projection chart** with a shaded confidence band, redrawn the moment you change anything.
- A plain-English explanation of *why* it says that.

**Targets are optional.** Open **🎯 Aim at a target** and type a number you're chasing — *then* you also get the big **probability %** of hitting it by your date, and an ETA. Leave it blank and you simply get the forecast. Same panel is where you swap the growth model (compounding %, best/likely/worst, steady average, posting frequency) if you'd rather use your own numbers than your logs.

### 4. Goals
- **Milestone timeline** — when you'll hit 500, 1k, 10k, 100k, 1M subs, based on your logged trend or a rate you type.
- **Monetization & revenue forecast** — predicted dates for both YPP tiers (it shows which path — watch hours or Shorts — gets you there first) and a rough monthly earnings estimate at your current pace.
- **What-if** — name a few scenarios (e.g. "current pace" vs "double effort") and watch them race on one chart.

### 5. Charts
See any metric's trend, and compare **Shorts vs long-form estimated revenue** side by side.

### 6. Backup ⚠️ important
Your data lives **only in this browser**. If you clear your browser data or switch devices, it's gone unless you exported it.
- **Export JSON** regularly — that's your full backup.
- **Import JSON** to restore it or move to another device.
- **Export CSV** to open your history in Excel / Google Sheets.

---

## 🧠 How the predictions work (in plain terms)

The app measures **your recent per-day pace**, then measures **whether that pace is speeding up or slowing down**, and carries both forward — with the acceleration fading the further out it looks. If your pace is essentially constant it just draws the straight line and says so.

Two things it deliberately refuses to do, because both produce nonsense:

- **Run away.** Fitting a raw exponential to a good month turns it into "3 billion subscribers by December". Here the acceleration decays geometrically, so your pace approaches a ceiling rather than compounding forever — and on top of that there's a hard backstop: no projection may exceed **four times your best-ever day-rate, sustained every day** from now to the target. Anything wilder is pulled back to that line.
- **Flat-line.** An S-curve fit decides growth is about to stop dead, which made a year-out subscriber forecast barely higher than today's. Channels build momentum far more often than they hit a wall, so no S-curve is used; a cooling channel is projected as *slowing*, never as *stopping*.

The **range** comes from how bumpy your history is — but never gets narrower than about **18% of the growth being projected**, because a tidy history doesn't make the future precise. (Before that floor, a neat run of logs produced bands like "1,059 to 1,066 subscribers in three months", which is a promise no forecast can keep.) It widens the further ahead you look.

Hover the little **?** icons anywhere in the app for a one-line definition of each term.

---

## ☁️ Sync across devices (optional)

Off by default: with no setup, your data never leaves the browser it was typed into. Turn this on and you sign in on your phone and your PC and see the same logs on both.

It needs somewhere to keep the data. That's a free **Supabase** project — you own it, and it's the only thing you have to create.

**One-time setup**

1. Sign up at [supabase.com](https://supabase.com) and create a project (the free tier is plenty — this stores a few kilobytes).
2. Open **SQL Editor → New query**, paste the contents of [`sql/setup.sql`](sql/setup.sql), and hit **Run**. That creates the table and the security rules that stop any account reading another's data.
3. Go to **Authentication → Sign In / Providers → Email** and turn **Confirm email** *off*. It's on by default, and with it on "Create account" won't sign you in until you've clicked a link in your inbox. (Leave it on if you'd rather — the app tells you to go and confirm.)
4. Open **Project Settings → API** and copy the **Project URL** plus the key labelled **`anon` / `public`** (newer projects call it a *publishable* key and it starts `sb_publishable_` — same thing). **Not** `service_role`.
5. Either paste them into `js/config.js` and push (best — then every device you open the site on is already set up), or paste them into the app itself: **Backup → Sync across devices**.
6. In the app, enter an email + password and hit **Create account**. On your other device, open the same site and **Sign in** with the same details.

### Is it safe to commit the anon key?

Yes — and more to the point, **you can't hide it anyway.** Anything the browser needs in order to make a request, the person using the browser can read: devtools → Network, or View Source. Typing the key into the app instead of committing it hides it from GitHub, not from anyone visiting the site.

That's fine, because the anon key isn't a password. It's a JWT whose whole payload is `{"role": "anon"}` — it identifies your project and says *"this request is from someone not signed in."* The security boundary is the row-level security policy, and it's absolute: every policy requires `auth.uid() = user_id`, so an unauthenticated caller matches **zero rows**. Someone who signs up in your project gets their own row and cannot address yours.

Two things worth doing anyway:

- **Turn off new signups once your accounts exist.** *Authentication → Sign In / Providers → Allow new users to sign up* → off. The anon key lets anyone reach your project's auth endpoints, so without this someone could create accounts against your quota (they still couldn't see your data). This is the single highest-value hardening step.
- `sql/setup.sql` also **revokes the table from the `anon` role** outright and grants it only to `authenticated`. Supabase's defaults hand both roles full table privileges and lean entirely on RLS; this way a mistake — RLS accidentally switched off — still fails closed instead of dumping every row.

What genuinely *is* secret, and must never appear in the app, a commit, or a screenshot:

- the **`service_role`** key (bypasses RLS completely — it's a master key)
- your **database password**

Your sign-in token is kept in `localStorage`, which is standard for a browser app. The risk there is script injection, so every user-typed value the app renders — video titles, descriptions, scenario names — is HTML-escaped, including inside attributes.

If you truly wanted the key off the page you'd need a server in front of Supabase (say a Cloudflare Worker) — but that server would then need its own credential in the browser, so it moves the problem rather than solving it. Not worth it here.

**How it behaves**

- Your browser stays the source of truth, so the app keeps working with no connection. Changes upload a couple of seconds after you stop typing, and it pulls when you open the page or hit **Sync now**.
- Two devices **merge** rather than overwrite. Readings are keyed by date (and by video), so logging Monday on your phone and Tuesday on your laptop keeps both. If you edited *the same* day on both, the more recent edit wins that day.
- **Deletions travel too.** Deleting a video on one device doesn't get resurrected by the other — but re-adding something after you deleted it does stick.
- **Signing out never deletes anything locally.** Your logs stay in that browser.
- The status pill in the sync card tells you where you stand: `off`, `signed out`, `syncing…`, `synced`, `offline`, or `problem` with the reason.

---

## 💰 Monetization facts baked in (correct as of 2026)

A common myth is that "Shorts don't count for monetization." **They do** — just differently:

**Fan Funding tier** (memberships, Super Thanks, Shopping — no ads yet) — needs **500 subscribers**, **3 public uploads in the last 90 days**, *and* **either**:
- **3,000 watch hours** in the past 12 months (long-form path), **or**
- **3,000,000 Shorts engaged views** in the past 90 days (Shorts path)

**Ad Revenue tier** (full monetization) — needs **1,000 subscribers** *and* **either**:
- **4,000 watch hours** in the past 12 months (long-form path), **or**
- **10,000,000 Shorts engaged views** in the past 90 days (Shorts path)

> **"Engaged views," not regular views.** For monetization YouTube counts *engaged* Shorts views — legitimate views tallied the strict, old way — **not** the inflated public "views" number shown on the video. Bot views, reused/non-original content, and policy-violating Shorts don't count.

**And Shorts earn far less per view.** Long-form RPM is typically **$3–$6**; Shorts RPM is roughly **$0.03–$0.20** (a pooled 45% revenue share vs. 55% on long-form). That's why this app estimates Shorts and long-form revenue **separately** and never blends them.

*Sources: [YouTube monetization requirements 2026](https://www.tubebuddy.com/blog/youtube-monetization-requirements/), [Shorts monetization & RPM 2026](https://vidiq.com/blog/post/youtube-shorts-monetization/), [YouTube Help — Shorts monetization](https://support.google.com/youtube/answer/12504220).*

---

## 🛠️ Tech notes

- Plain HTML/CSS/JavaScript — **no build step**, so GitHub Pages just works.
- Charts via [Chart.js](https://www.chartjs.org/) (loaded from a CDN).
- Data stored in your browser's `localStorage` under the key `ytPredictor.v1`.
- Optional sync lives in `js/sync.js` — plain `fetch` against Supabase's REST endpoints, no SDK and no extra CDN script. With `js/config.js` left empty it never touches the network.
- If YouTube changes its rules, edit the thresholds in `js/monetization.js`.

## ⚠️ Disclaimer
Predictions are estimates based on your own numbers and past trends — real growth depends on the algorithm, your content, and luck. Use them as a guide, not a guarantee.
