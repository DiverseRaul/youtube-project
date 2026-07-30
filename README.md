# 📈 YouTube Channel Predictor & Tracker

A free, no-login website to **track your YouTube stats over time** and **predict** subscribers, views, watch hours, revenue, and monetization — with plain-English probabilities like *"~72% chance of hitting 1,000 subs by Oct 15."*

Everything runs in your browser. **No server, no accounts, no API keys.** You type your numbers in; it does the math and draws the graphs.

---

## ✨ What it does

- **Daily Log** — type in your channel totals whenever you check them (with Edit ✎ / Delete ✕ on every row).
- **Videos** — track individual videos over time (Shorts and long-form kept separate).
- **Predict** — pick a goal + date and get a probability, a projection chart, and a clear explanation, using the growth **shape** that fits you (see below).
- **Goals** — auto ETAs for every milestone (1k → 1M), a monetization + revenue forecast, and a **what-if** compare chart.
- **Charts** — trend lines for every metric + a Shorts-vs-long-form revenue split.
- **Backup** — export/import JSON (full backup), export CSV, and **import CSV** to bulk-load history from a spreadsheet.

### Insights & goal tracking
- **Goals for any metric** (Goals tab) — set targets for subscribers, long-form views, watch hours, Shorts engaged views, or **monthly revenue ($)**. Each shows a progress bar, a projected date, and an on-track / behind verdict.
- **"Am I on track?" banner** (Dashboard) — features your main goal and tells you live whether you're on pace, the daily rate you need, and how likely you are to make it.
- **Best time & day to post** (Videos tab) — since you log each video's upload time, it averages performance by weekday and time-of-day and tells you when your posts do best.
- **Video leaderboard** (Videos tab) — ranks your videos by views, views/day, or engagement %, with likes/comments rates so you see what resonates.

### Growth models (because growth is never a flat line)
On the **Predict** tab, choose how you think your channel grows:
- **🤖 Smart** — learns the best-fitting curve from your logged history automatically.
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
Add each video with a **title**, **type** (Long or Short), **publish date + upload time**, and a short **description** of what it's about (so you remember it later). Click **Log stats** to record its views/likes over time — the panel shows when it went live, how long ago, your last reading, and tells you the growth since last time (e.g. "+1,500 views since Jul 10 (150/day)"). Shorts are tracked separately and never mixed into long-form watch hours.

### 3. Predict
Choose what to forecast, a **target number**, and a **date**. You get:
- A big **probability %** of hitting the target by that date.
- The **expected value** and a likely **range**.
- A **projection chart** with a shaded "confidence band."
- A plain-English explanation of *why*.

Prefer your own numbers? Switch **Method → Manual average** and type a growth-per-day figure.

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

The app looks at your history and fits **three growth shapes**, then picks whichever matches your data best:

- **Steady (linear)** — you gain about the same amount every day.
- **Accelerating (exponential)** — growth compounds and speeds up.
- **S-curve (logistic)** — growth speeds up, then levels off.

It then projects that shape forward to your target date. The **range** and **probability** come from how *bumpy* your past data is: steadier history → tighter range and a more confident percentage. Forecasts far in the future are naturally less certain, so the band widens.

Hover the little **?** icons anywhere in the app for a one-line definition of each term.

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
- If YouTube changes its rules, edit the thresholds in `js/monetization.js`.

## ⚠️ Disclaimer
Predictions are estimates based on your own numbers and past trends — real growth depends on the algorithm, your content, and luck. Use them as a guide, not a guarantee.
