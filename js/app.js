/* ============================================================
   app.js — boots the app, handles tabs, forms, rendering, wiring.
   Loaded LAST so all YT.* modules exist.
   ============================================================ */
(function () {
  "use strict";

  var S = window.YT.storage;
  var stats = window.YT.stats;
  var explain = window.YT.explain;
  var mon = window.YT.monetization;
  var vids = window.YT.videos;
  var charts = window.YT.charts;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var fmt = explain.fmt;

  var activeVideoId = null;

  /* ================= boot ================= */
  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(S.getState().settings.theme);
    wireTabs();
    wireTheme();
    wireTooltips();
    wireSnapshotForm();
    wireVideoForms();
    wirePredictForm();
    wireGoals();
    wireGoalForm();
    wireCharts();
    wireBackup();
    renderAll();
  });

  function renderAll() {
    renderDashboard();
    renderLog();
    renderVideos();
    renderGoals();
    renderCharts();
  }

  /* ================= tabs ================= */
  function wireTabs() {
    $$("#tabs .tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$("#tabs .tab").forEach(function (b) { b.classList.remove("active"); b.removeAttribute("aria-current"); });
        $$(".panel").forEach(function (p) { p.classList.remove("active"); });
        btn.classList.add("active");
        btn.setAttribute("aria-current", "page");
        var id = btn.getAttribute("data-tab");
        $("#tab-" + id).classList.add("active");
        // Land at the top of the new section, and keep the active tab in view.
        if (window.scrollTo) window.scrollTo({ top: 0, behavior: "smooth" });
        if (btn.scrollIntoView) btn.scrollIntoView({ block: "nearest", inline: "center" });
        // Charts must (re)draw when their panel becomes visible.
        if (id === "charts") renderCharts();
        if (id === "dashboard") renderDashboard();
        if (id === "goals") renderGoals();
      });
    });
  }

  /* ================= theme ================= */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btn = $("#themeToggle");
    if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
  }
  function wireTheme() {
    $("#themeToggle").addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(next);
      S.updateSettings({ theme: next });
      renderCharts(); // recolor charts for the new theme
      if ($("#predictResult") && !$("#predictResult").classList.contains("hidden")) lastPredict && drawPredictChart(lastPredict);
    });
  }

  /* ================= tooltips ================= */
  function wireTooltips() {
    var tip = $("#tooltip");
    function show(el) {
      var text = el.getAttribute("data-help");
      if (!text) return;
      tip.textContent = text;
      tip.classList.remove("hidden");
      var r = el.getBoundingClientRect();
      var top = r.bottom + 8, left = r.left;
      tip.style.left = Math.min(left, window.innerWidth - 280) + "px";
      tip.style.top = top + "px";
    }
    function hide() { tip.classList.add("hidden"); }
    document.addEventListener("mouseover", function (e) {
      var el = e.target.closest && e.target.closest(".help");
      if (el) show(el);
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(".help")) hide();
    });
    // Tap support for touch devices.
    document.addEventListener("click", function (e) {
      var el = e.target.closest && e.target.closest(".help");
      if (el) { show(el); setTimeout(hide, 3500); }
    });
  }

  /* ================= toast ================= */
  var toastTimer = null;
  function toast(msg, isErr) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add("hidden"); }, 2600);
  }

  /* ================= DASHBOARD ================= */
  function renderDashboard() {
    var st = S.getState();
    var snaps = st.channelSnapshots;
    var hasData = snaps.length > 0;
    $("#dashboardEmpty").classList.toggle("hidden", hasData);
    $("#dashboardBody").classList.toggle("hidden", !hasData);
    if (!hasData) return;

    renderGoalBanner();

    var latest = snaps[snaps.length - 1];
    var prev = snaps.length > 1 ? snaps[snaps.length - 2] : null;
    var rev = mon.estimateRevenue(latest);
    var monetized = mon.evaluate(latest).adRevenue.unlocked;

    // Revenue tile is monetization-aware: $0 until you're actually in the YPP.
    var revValue, revSub;
    if (monetized) {
      revValue = "$" + rev.total.toLocaleString("en-US", { maximumFractionDigits: 0 });
      revSub = "<span class='muted'>Long $" + rev.longRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 }) +
        " · Shorts $" + rev.shortsRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 }) + "</span>";
    } else {
      revValue = "$0";
      revSub = "<span class='muted'>🔒 Not monetized yet · ~$" + rev.total.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " potential</span>";
    }

    // ---- stat tiles ----
    var tiles = [
      tile("Subscribers", fmt(latest.totalSubs), delta("totalSubs", latest, prev), "How many subscribers you have now."),
      tile("Long-form views", fmt(latest.longformViews), delta("longformViews", latest, prev), "Lifetime views on regular videos."),
      tile("Watch hours", fmt(latest.watchHoursTotal), delta("watchHoursTotal", latest, prev), "Toward the 4,000-hour monetization path."),
      tile("Shorts views (90d)", fmt(latest.shortsViews90d), delta("shortsViews90d", latest, prev), "Toward the 10M-views monetization path."),
      tile(monetized ? "Est. revenue" : "Revenue", revValue, revSub,
        "You only collect ad revenue once you're in the YouTube Partner Program. Until then this is $0, with your potential earnings shown for reference. Rough estimate = views ÷ 1,000 × RPM, long-form and Shorts counted separately.")
    ];
    $("#statTiles").innerHTML = tiles.join("");

    // ---- monetization ----
    renderMonetization(mon.evaluate(latest));

    // ---- milestones ----
    renderMilestones(snaps, st.settings);
  }

  function tile(label, value, sub, help) {
    return "<div class='stat-tile'><div class='label'>" + label +
      (help ? " <span class='help' data-help=\"" + esc(help) + "\">?</span>" : "") +
      "</div><div class='value'>" + value + "</div><div class='delta'>" + (sub || "") + "</div></div>";
  }
  function delta(key, latest, prev) {
    if (!prev) return "<span class='flat'>first reading</span>";
    var diff = (Number(latest[key]) || 0) - (Number(prev[key]) || 0);
    var days = Math.max(1, stats.daysBetween(prev.date, latest.date));
    var perDay = diff / days;
    var cls = diff > 0 ? "up" : (diff < 0 ? "down" : "flat");
    var arrow = diff > 0 ? "▲" : (diff < 0 ? "▼" : "•");
    return "<span class='" + cls + "'>" + arrow + " " + explain.fmtRate(perDay) + "/day</span>";
  }

  function renderMonetization(ev) {
    function reqRow(r) {
      var doneCls = r.done ? " done" : "";
      var barCls = "bar" + doneCls + (r.path === "shorts" ? " shorts" : "");
      return "<div class='req'><div class='req-label'><span>" + r.label + "</span>" +
        "<span>" + fmt(r.value) + " / " + fmt(r.target) + " " + (r.unit || "") + "</span></div>" +
        "<div class='" + barCls + "'><span style='width:" + r.pct.toFixed(1) + "%'></span></div></div>";
    }
    function tierHead(name, unlocked, blurb) {
      var badge = unlocked ? "<span class='tier-badge unlocked'>UNLOCKED</span>" : "<span class='tier-badge locked'>LOCKED</span>";
      return "<div class='tier-head'><h4 style='margin:0'>" + name + "</h4>" + badge + "</div>" +
        "<p class='muted' style='margin-bottom:6px'>" + blurb + "</p>";
    }
    // Both tiers share the same shape: base requirement(s) AND one of the paths.
    function tier(t) {
      var html = "<div class='tier'>" + tierHead(t.name, t.unlocked, t.blurb);
      t.base.forEach(function (r) { html += reqRow(r); });
      html += "<div class='or-divider'>— AND either of these paths —</div>";
      t.paths.forEach(function (r, i) {
        if (i > 0) html += "<div class='or-divider'>OR</div>";
        html += reqRow(r);
      });
      return html + "</div>";
    }

    var html = tier(ev.fanFunding) + tier(ev.adRevenue);
    html += "<p class='muted' style='margin-top:8px'>Note: Shorts really do count toward monetization — via the engaged-views path — but Shorts earn far less per view than long-form. \"Engaged views\" are legitimate views counted the strict way, not the inflated public view count.</p>";
    $("#monetizationBody").innerHTML = html;
  }

  function renderMilestones(snaps, settings) {
    var goalDate = settings.goalDate || stats.addDays(snaps[snaps.length - 1].date, 365);
    var rows = mon.trackedKeys().map(function (m) {
      var r = stats.forecast(snaps, m.key, goalDate, m.target, { method: "auto" });
      if (!r.ok) return "<div class='milestone'><span>" + m.label + "</span><span class='muted'>needs more data</span></div>";
      var when = r.alreadyHit ? "✅ done" : (r.etaDate ? explain.prettyDate(r.etaDate) : "not on pace");
      var prob = r.alreadyHit ? "" : " <span class='muted'>(" + Math.round(r.probability * 100) + "% by " + explain.prettyDate(goalDate) + ")</span>";
      return "<div class='milestone'><span>" + m.label + "</span><span class='eta'>" + when + prob + "</span></div>";
    });
    $("#milestonesBody").innerHTML = rows.join("");
  }

  var GOAL_NAMES = {
    totalSubs: "Subscribers", longformViews: "Long-form views",
    watchHoursTotal: "Watch hours", shortsViews90d: "Shorts engaged views",
    revenue: "Monthly revenue"
  };
  function goalMetricName(m) { return GOAL_NAMES[m] || m; }
  function goalFormatValue(metric, val) {
    if (metric === "revenue") return "$" + Math.round(Number(val) || 0).toLocaleString("en-US");
    return fmt(val);
  }
  // Current value for a goal metric. "revenue" = estimated $/month at current pace.
  function currentMetricValue(metric) {
    var snaps = S.getState().channelSnapshots;
    if (!snaps.length) return null;
    var latest = snaps[snaps.length - 1];
    if (metric === "revenue") {
      var sl = stats.suggestFromLogs(snaps, "longformViews");
      var ss = stats.suggestFromLogs(snaps, "shortsViews90d");
      var lpd = sl ? Math.max(0, sl.perDay) : 0, spd = ss ? Math.max(0, ss.perDay) : 0;
      return lpd * 30 / 1000 * (Number(latest.longRPM) || 0) + spd * 30 / 1000 * (Number(latest.shortsRPM) || 0);
    }
    return Number(latest[metric]) || 0;
  }

  // Are you actually in the Partner Program (can collect ad revenue)?
  function isMonetized() {
    var l = S.latestSnapshot();
    return l ? mon.evaluate(l).adRevenue.unlocked : false;
  }
  // Projected date you'd reach the ad-revenue tier ("now" if already there, null if not on pace).
  function adRevenueDate() {
    var snaps = S.getState().channelSnapshots;
    var l = S.latestSnapshot();
    if (!l) return null;
    if (mon.evaluate(l).adRevenue.unlocked) return "now";
    if (snaps.length < 2) return null;
    var today = new Date().toISOString().slice(0, 10);
    var far = stats.addDays(today, 3650 * 3);
    function eta(m, t) { var r = stats.forecast(snaps, m, far, t, { method: "auto" }); return r.ok ? r.etaDate : null; }
    var subs = eta("totalSubs", 1000), w = eta("watchHoursTotal", 4000), sh = eta("shortsViews90d", 10000000);
    var path = (!w) ? sh : ((!sh) ? w : (w < sh ? w : sh)); // earliest path
    if (!subs || !path) return null;
    return subs > path ? subs : path; // need subs AND a path
  }

  // Generalized assessment for ANY goal metric.
  function goalAssessment(goal) {
    if (!goal) return null;
    var snaps = S.getState().channelSnapshots;
    if (!snaps.length) return null;
    var metric = goal.metric, target = Number(goal.target) || 0, date = goal.date || "";
    if (target <= 0) return null;
    var current = currentMetricValue(metric);
    if (current == null) return null;
    if (metric === "revenue") {
      // A monthly rate, not a cumulative finish line. And you earn $0 until you're
      // actually monetized — so "current" reflects that, with the potential shown too.
      var potential = current;
      var monetized = isMonetized();
      var actual = monetized ? potential : 0;
      return { kind: "rate", metric: metric, target: target, date: date, current: actual, potential: potential, monetized: monetized, reached: actual >= target };
    }
    var reached = current >= target;
    var today = new Date().toISOString().slice(0, 10);
    var daysLeft = date ? stats.daysBetween(today, date) : null;
    var sug = stats.suggestFromLogs(snaps, metric);
    var curPerDay = sug ? Math.max(0, sug.perDay) : 0;
    var needPerDay = (date && daysLeft > 0) ? (target - current) / daysLeft : null;
    var prob = (date && snaps.length >= 2) ? stats.forecast(snaps, metric, date, target, { method: "auto" }).probability : null;
    var far = stats.addDays(today, 3650 * 3);
    var etaR = stats.forecastFromAverage(current, curPerDay, today, far, target, metric);
    var eta = reached ? today : (etaR.ok ? etaR.etaDate : null);
    return {
      kind: "cumulative", metric: metric, target: target, date: date, current: current, daysLeft: daysLeft,
      reached: reached, curPerDay: curPerDay, needPerDay: needPerDay, prob: prob, eta: eta,
      onTrack: needPerDay != null ? curPerDay >= needPerDay : curPerDay > 0
    };
  }

  // Pick the goal to feature in the dashboard banner (prefer a subs goal w/ date).
  function primaryGoal() {
    var goals = S.getState().settings.goals || [];
    return goals.filter(function (g) { return g.metric === "totalSubs" && g.date; })[0]
      || goals.filter(function (g) { return g.date && g.metric !== "revenue"; })[0]
      || goals[0] || null;
  }

  // "Am I on track?" banner (Dashboard).
  function renderGoalBanner() {
    var banner = $("#trackBanner");
    var g = primaryGoal();
    var a = goalAssessment(g);
    if (!a) { banner.classList.add("hidden"); return; }
    banner.classList.remove("hidden");
    var name = goalMetricName(g.metric);
    if (a.reached) {
      banner.className = "track-banner good";
      banner.innerHTML = "🎉 <strong>Goal reached!</strong> " + name + " passed " + goalFormatValue(g.metric, a.target) + ".";
      return;
    }
    if (a.kind === "rate" || !a.date) {
      var pctp = Math.min(100, a.current / a.target * 100);
      banner.className = "track-banner warn";
      banner.innerHTML = "🎯 <strong>" + name + " goal:</strong> " + goalFormatValue(g.metric, a.current) + " / " +
        goalFormatValue(g.metric, a.target) + " (" + pctp.toFixed(0) + "%)." +
        (a.kind === "cumulative" && a.eta ? " ETA " + explain.prettyDate(a.eta) + "." : "");
      return;
    }
    if (a.daysLeft <= 0) {
      banner.className = "track-banner bad";
      banner.innerHTML = "⏰ " + name + " goal date has passed — " + goalFormatValue(g.metric, a.current) + " of " + goalFormatValue(g.metric, a.target) + ".";
      return;
    }
    var pct = a.prob != null ? Math.round(a.prob * 100) : null;
    banner.className = "track-banner " + (a.onTrack ? "good" : (a.curPerDay >= a.needPerDay * 0.6 ? "warn" : "bad"));
    banner.innerHTML = (a.onTrack ? "✅ <strong>On track</strong>" : "⚠️ <strong>Behind pace</strong>") +
      " for " + goalFormatValue(g.metric, a.target) + " " + name.toLowerCase() + " by " + explain.prettyDate(a.date) + ". " +
      "Gaining <strong>" + explain.fmtRate(a.curPerDay) + "/day</strong>; need <strong>" + explain.fmtRate(a.needPerDay) + "/day</strong>." +
      (pct != null ? " <span class='muted'>(~" + pct + "% likely)</span>" : "");
  }

  // List of all goals with progress + status on the Goals tab.
  function renderGoalsList() {
    var goals = S.getState().settings.goals || [];
    var box = $("#goalsList");
    if (!goals.length) {
      box.innerHTML = "<p class='muted'>No goals yet. Add one above — subscribers, views, watch hours, or monthly revenue.</p>";
      return;
    }
    box.innerHTML = goals.map(function (g) { return goalCard(g, goalAssessment(g)); }).join("");
    $$("[data-delgoal]", box).forEach(function (btn) {
      btn.addEventListener("click", function () {
        S.deleteGoal(btn.getAttribute("data-delgoal"));
        toast("Goal removed.");
        renderDashboard();
        renderGoals();
      });
    });
  }

  function goalCard(g, a) {
    var name = goalMetricName(g.metric);
    var head = "<div class='goal-item-head'><span><strong>" + name + "</strong> → " + goalFormatValue(g.metric, g.target) +
      (g.date ? " <span class='muted'>by " + explain.prettyDate(g.date) + "</span>" : "") + "</span>" +
      "<button class='row-del' data-delgoal='" + g.id + "' title='Remove goal'>✕</button></div>";
    if (!a) return "<div class='goal-item'>" + head + "<p class='muted'>Log a snapshot to start tracking this.</p></div>";
    var pct = Math.min(100, a.current / a.target * 100);
    var bar = "<div class='goal-prog-label'><span>" + goalFormatValue(g.metric, a.current) + " / " + goalFormatValue(g.metric, a.target) +
      (g.metric === "revenue" ? "/mo" : "") + "</span><span>" + pct.toFixed(0) + "%</span></div>" +
      "<div class='bar" + (a.reached ? " done" : "") + "'><span style='width:" + pct + "%'></span></div>";
    var msg = "";
    if (a.reached) {
      msg = "<p class='goal-msg good'>🎉 Reached!</p>";
    } else if (a.kind === "rate") {
      if (!a.monetized) {
        var mdate = adRevenueDate();
        var whenMon = (mdate && mdate !== "now") ? " (on track for ~" + explain.prettyDate(mdate) + ")" : "";
        msg = "<p class='goal-msg bad'>🔒 Not monetized yet — earning $0</p>" +
          "<p class='muted'>You can't collect ad revenue until you join the YouTube Partner Program" + whenMon + ". Once you qualify, at your current pace you'd make about <strong>" + goalFormatValue("revenue", a.potential) + "/mo</strong> toward your " + goalFormatValue("revenue", a.target) + "/mo goal.</p>";
      } else {
        msg = "<p class='muted'>At your current pace you're earning about " + goalFormatValue(g.metric, a.current) + "/mo. Grow your views to close the gap (revenue isn't a fixed finish line).</p>";
      }
    } else {
      var etaLine = a.eta ? "projected " + explain.prettyDate(a.eta) + " (" + relativeWhen(a.eta) + ")" : "not on current pace";
      if (a.date && a.daysLeft != null) {
        if (a.daysLeft > 0) {
          var p = a.prob != null ? " (~" + Math.round(a.prob * 100) + "% likely)" : "";
          msg = "<p class='muted' style='margin-top:8px'>" + a.daysLeft + " days left · " + etaLine + "</p>" +
            "<p class='goal-msg " + (a.onTrack ? "good" : "bad") + "'>" + (a.onTrack ? "✅ On track" : "⚠️ Behind") +
            " — gaining " + explain.fmtRate(a.curPerDay) + "/day, need " + explain.fmtRate(a.needPerDay) + "/day" + p + "</p>";
        } else {
          msg = "<p class='goal-msg bad'>Target date has passed.</p>";
        }
      } else {
        msg = "<p class='muted' style='margin-top:8px'>" + etaLine + " · add a date to check your pace.</p>";
      }
    }
    return "<div class='goal-item'>" + head + bar + msg + "</div>";
  }

  function wireGoalForm() {
    var metricSel = $("#goalMetric");
    var targetInput = $("#goalTargetInput");
    function syncPlaceholder() {
      targetInput.placeholder = metricSel.value === "revenue" ? "e.g. 500 ($/month)"
        : (metricSel.value === "totalSubs" ? "e.g. 1000" : "e.g. 100000");
    }
    metricSel.addEventListener("change", syncPlaceholder);
    syncPlaceholder();
    $("#goalForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var d = formData($("#goalForm"));
      if (!d.target || Number(d.target) <= 0) { toast("Enter a target value.", true); return; }
      S.addGoal({ metric: d.metric, target: Number(d.target), date: d.date || "" });
      $("#goalTargetInput").value = "";
      $("#goalDateInput").value = "";
      toast(goalMetricName(d.metric) + " goal added.");
      renderDashboard();
      renderGoals();
    });
  }

  /* ================= DAILY LOG ================= */
  function wireSnapshotForm() {
    var form = $("#snapshotForm");
    // Default the date field to today.
    $("input[name=date]", form).value = new Date().toISOString().slice(0, 10);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = formData(form);
      if (!data.date) { toast("Pick a date first.", true); return; }
      S.upsertSnapshot(data);
      form.reset();
      $("input[name=date]", form).value = new Date().toISOString().slice(0, 10);
      toast("Snapshot saved.");
      renderAll();
    });
  }

  function renderLog() {
    var snaps = S.getState().channelSnapshots.slice().reverse(); // newest first
    var tbody = $("#snapshotTable tbody");
    tbody.innerHTML = snaps.map(function (s) {
      return "<tr>" +
        "<td>" + explain.prettyDate(s.date) + "</td>" +
        "<td>" + fmt(s.totalSubs) + "</td>" +
        "<td>" + fmt(s.longformViews) + "</td>" +
        "<td>" + fmt(s.watchHoursTotal) + "</td>" +
        "<td>" + fmt(s.shortsViews90d) + "</td>" +
        "<td>$" + (Number(s.longRPM) || 0).toFixed(2) + "</td>" +
        "<td>$" + (Number(s.shortsRPM) || 0).toFixed(3) + "</td>" +
        "<td><button class='row-edit' data-edit='" + s.date + "' title='Edit'>✎</button> " +
        "<button class='row-del' data-date='" + s.date + "' title='Delete'>✕</button></td>" +
        "</tr>";
    }).join("");
    $("#snapshotCount").textContent = snaps.length + " reading" + (snaps.length === 1 ? "" : "s");
    $$(".row-del", tbody).forEach(function (btn) {
      btn.addEventListener("click", function () {
        S.deleteSnapshot(btn.getAttribute("data-date"));
        toast("Deleted.");
        renderAll();
      });
    });
    $$(".row-edit", tbody).forEach(function (btn) {
      btn.addEventListener("click", function () { editSnapshot(btn.getAttribute("data-edit")); });
    });
  }

  // Load an existing snapshot back into the form. Saving overwrites it
  // (upsert is keyed on date), so this is how you change subs/views/etc.
  function editSnapshot(date) {
    var s = S.getState().channelSnapshots.filter(function (x) { return x.date === date; })[0];
    if (!s) return;
    var f = $("#snapshotForm");
    f.date.value = s.date;
    f.totalSubs.value = s.totalSubs;
    f.longformViews.value = s.longformViews;
    f.watchHoursTotal.value = s.watchHoursTotal;
    f.shortsViews90d.value = s.shortsViews90d;
    f.longRPM.value = s.longRPM;
    f.shortsRPM.value = s.shortsRPM;
    scrollTo(f);
    f.totalSubs.focus();
    toast("Editing " + explain.prettyDate(s.date) + " — change the numbers and press Save.");
  }

  /* ================= VIDEOS ================= */
  function wireVideoForms() {
    var vform = $("#videoForm");
    $("input[name=publishDate]", vform).value = new Date().toISOString().slice(0, 10);
    vform.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = formData(vform);
      if (!d.title) { toast("Give the video a title.", true); return; }
      S.addVideo(d);
      vform.reset();
      $("input[name=publishDate]", vform).value = new Date().toISOString().slice(0, 10);
      toast("Video added.");
      renderVideos();
    });

    $("#closeVideoSnap").addEventListener("click", function () {
      activeVideoId = null;
      $("#videoSnapshotCard").classList.add("hidden");
    });

    $("#leaderboardMetric").addEventListener("change", renderInsights);

    $("#videoSnapshotForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!activeVideoId) return;
      var d = formData($("#videoSnapshotForm"));
      d.videoId = activeVideoId;
      if (!d.date) { toast("Pick a date.", true); return; }
      // Work out growth since the last reading (before saving this one).
      var prev = S.snapshotsForVideo(activeVideoId);
      var prevLast = prev.length ? prev[prev.length - 1] : null;
      S.addVideoSnapshot(d);
      var msg = "Reading saved.";
      if (prevLast && prevLast.date !== d.date) {
        var dv = (Number(d.views) || 0) - prevLast.views;
        var days = Math.max(1, stats.daysBetween(prevLast.date, d.date));
        msg = "Saved — " + (dv >= 0 ? "+" : "") + fmt(dv) + " views since " + explain.prettyDate(prevLast.date) +
          " (" + explain.fmtRate(dv / days) + "/day).";
      }
      e.target.reset();
      toast(msg);
      openVideo(activeVideoId);
      renderVideos();
    });
  }

  function renderVideos() {
    var st = S.getState();
    var list = $("#videoList");
    if (!st.videos.length) {
      list.innerHTML = "<p class='muted'>No videos yet. Add one above to start tracking it.</p>";
      return;
    }
    list.innerHTML = st.videos.map(function (v) {
      var snaps = S.snapshotsForVideo(v.id);
      var sum = vids.summary(v, snaps);
      var typeTag = "<span class='type-tag " + v.type + "'>" + (v.type === "short" ? "SHORT" : "LONG") + "</span>";
      var when = explain.prettyDate(v.publishDate) + (v.publishTime ? " · " + v.publishTime : "");
      var stat = sum.hasData
        ? fmt(sum.latestViews) + " views · " + explain.fmtRate(sum.viewsPerDay) + "/day"
        : "no readings yet";
      var desc = v.description ? "<div class='vdesc'>" + esc(v.description) + "</div>" : "";
      return "<div class='video-item'>" +
        "<div class='meta'>" + typeTag +
        "<div style='min-width:0'><div class='vtitle'>" + esc(v.title) + "</div>" +
        desc +
        "<div class='muted'>" + when + " · " + stat + "</div></div></div>" +
        "<div class='btn-row'>" +
        "<button class='btn small' data-open='" + v.id + "'>Log stats</button>" +
        "<button class='btn ghost small' data-delv='" + v.id + "'>Delete</button>" +
        "</div></div>";
    }).join("");

    $$("[data-open]", list).forEach(function (b) {
      b.addEventListener("click", function () { openVideo(b.getAttribute("data-open")); });
    });
    $$("[data-delv]", list).forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Delete this video and all its readings?")) return;
        var id = b.getAttribute("data-delv");
        S.deleteVideo(id);
        if (activeVideoId === id) { activeVideoId = null; $("#videoSnapshotCard").classList.add("hidden"); }
        toast("Video deleted.");
        renderVideos();
      });
    });

    renderInsights();
  }

  /* ---- Insights: best time to post + leaderboard ---- */
  function insightBars(list) {
    if (!list.length) return "<p class='muted'>—</p>";
    var max = Math.max.apply(null, list.map(function (o) { return o.avg; })) || 1;
    return list.map(function (o) {
      var w = (o.avg / max * 100).toFixed(0);
      return "<div class='ibar'><span class='ibar-label'>" + o.label + "</span>" +
        "<span class='ibar-track'><span style='width:" + w + "%'></span></span>" +
        "<span class='ibar-val'>" + explain.fmt(o.avg) + "/d</span></div>";
    }).join("");
  }

  function renderInsights() {
    var ins = window.YT.insights;
    var today = new Date().toISOString().slice(0, 10);
    var snapsOf = function (id) { return S.snapshotsForVideo(id); };
    var videos2 = S.getState().videos;

    var a = ins.bestPostAnalysis(videos2, snapsOf, today);
    var box = $("#bestTimeBody");
    if (a.count < 1) {
      box.innerHTML = "<p class='muted'>Add videos with an upload time and at least one stats reading to see when your posts perform best.</p>";
    } else {
      var html = "";
      if (a.bestDay) html += "<p>📅 Best day: <strong>" + a.bestDay.label + "</strong> (avg " + explain.fmt(a.bestDay.avg) + " views/day)</p>";
      if (a.bestTime) html += "<p>🕐 Best time: <strong>" + a.bestTime.label + "</strong> (avg " + explain.fmt(a.bestTime.avg) + " views/day)</p>";
      if (a.count < 3) html += "<p class='muted'>Based on only " + a.count + " video" + (a.count === 1 ? "" : "s") + " — add more for a reliable pattern.</p>";
      html += "<div class='insight-cols'>";
      html += "<div><h4 class='insight-h'>By weekday</h4>" + insightBars(a.byWeekday) + "</div>";
      html += "<div><h4 class='insight-h'>By time of day</h4>" + insightBars(a.byTime) + "</div>";
      html += "</div>";
      box.innerHTML = html;
    }

    var metricEl = $("#leaderboardMetric");
    var metric = metricEl ? metricEl.value : "viewsPerDay";
    var rows = ins.leaderboard(videos2, snapsOf, today, metric);
    var tb = $("#leaderboardTable tbody");
    if (!rows.length) {
      tb.innerHTML = "<tr><td colspan='7' class='muted'>No videos with readings yet — log stats on a video first.</td></tr>";
    } else {
      tb.innerHTML = rows.map(function (r, i) {
        var v = r.video, p = r.perf;
        var medal = i === 0 ? "🥇" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : (i + 1)));
        return "<tr><td>" + medal + "</td><td style='text-align:left'>" + esc(v.title) + "</td>" +
          "<td><span class='type-tag " + v.type + "'>" + (v.type === "short" ? "SHORT" : "LONG") + "</span></td>" +
          "<td>" + fmt(p.latestViews) + "</td><td>" + explain.fmtRate(p.viewsPerDay) + "</td>" +
          "<td>" + p.likeRate.toFixed(1) + "%</td><td>" + p.commentRate.toFixed(2) + "%</td></tr>";
      }).join("");
    }
  }

  function openVideo(id) {
    var st = S.getState();
    var video = st.videos.filter(function (v) { return v.id === id; })[0];
    if (!video) return;
    activeVideoId = id;
    $("#videoSnapshotCard").classList.remove("hidden");
    $("#activeVideoTitle").textContent = video.title;
    $("input[name=date]", $("#videoSnapshotForm")).value = new Date().toISOString().slice(0, 10);

    var snaps = S.snapshotsForVideo(id);
    var last = snaps.length ? snaps[snaps.length - 1] : null;

    // Helpful context line: what it's about, when it went live, last reading.
    var today = new Date().toISOString().slice(0, 10);
    var daysLive = video.publishDate ? stats.daysBetween(video.publishDate, today) : null;
    var bits = [];
    if (video.description) bits.push("<div class='vdesc'>" + esc(video.description) + "</div>");
    var line = "<span class='type-tag " + video.type + "'>" + (video.type === "short" ? "SHORT" : "LONG") + "</span> ";
    line += "Published " + explain.prettyDate(video.publishDate) + (video.publishTime ? " at " + video.publishTime : "");
    if (daysLive != null) line += " · " + (daysLive <= 0 ? "today" : daysLive + " days ago");
    line += last
      ? " · last logged <strong>" + fmt(last.views) + "</strong> views on " + explain.prettyDate(last.date)
      : " · no readings yet — add your first below";
    bits.push("<div class='muted'>" + line + "</div>");
    $("#videoLogInfo").innerHTML = bits.join("");

    // Prefill inputs with the last reading as a starting point (easy to bump up).
    var f = $("#videoSnapshotForm");
    if (last) {
      f.querySelector("[name=views]").placeholder = "last: " + fmt(last.views);
      f.querySelector("[name=likes]").placeholder = "last: " + fmt(last.likes);
      f.querySelector("[name=comments]").placeholder = "last: " + fmt(last.comments);
      f.querySelector("[name=watchHours]").placeholder = "last: " + fmt(last.watchHours);
    }

    var tbody = $("#videoSnapTable tbody");
    tbody.innerHTML = snaps.slice().reverse().map(function (s) {
      return "<tr><td>" + explain.prettyDate(s.date) + "</td><td>" + fmt(s.views) + "</td><td>" +
        fmt(s.likes) + "</td><td>" + fmt(s.comments) + "</td><td>" + fmt(s.watchHours) +
        "</td><td><button class='row-edit' data-vsedit='" + s.date + "' title='Edit'>✎</button> " +
        "<button class='row-del' data-vsdate='" + s.date + "'>✕</button></td></tr>";
    }).join("");
    $$(".row-del", tbody).forEach(function (btn) {
      btn.addEventListener("click", function () {
        S.deleteVideoSnapshot(id, btn.getAttribute("data-vsdate"));
        openVideo(id); renderVideos();
      });
    });
    $$(".row-edit", tbody).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var s = S.snapshotsForVideo(id).filter(function (x) { return x.date === btn.getAttribute("data-vsedit"); })[0];
        if (!s) return;
        var f = $("#videoSnapshotForm");
        f.date.value = s.date; f.views.value = s.views; f.likes.value = s.likes;
        f.comments.value = s.comments; f.watchHours.value = s.watchHours;
        f.views.focus();
        toast("Editing " + explain.prettyDate(s.date) + " — change the numbers and press Add reading.");
      });
    });
    charts.video("videoChart", vids.viewPoints(snaps), video.title, video.type === "short");
    scrollTo($("#videoSnapshotCard"));
  }

  /* ================= PREDICT ================= */
  var lastPredict = null;
  function wirePredictForm() {
    var form = $("#predictForm");
    var st = S.getState();
    // Sensible defaults from saved goal.
    $("input[name=target]", form).value = st.settings.goalSubs || 1000;
    $("input[name=targetDate]", form).value = st.settings.goalDate ||
      stats.addDays(new Date().toISOString().slice(0, 10), 90);

    function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

    // Show only the input groups relevant to the chosen model.
    function toggleMethod() {
      var m = $("#predictMethod").value;
      $$(".pfield", form).forEach(function (el) {
        var models = (el.getAttribute("data-models") || "").split(" ");
        el.classList.toggle("hidden", models.indexOf(m) === -1);
      });
      if (m !== "auto") smartPrefill(false);
    }

    // Look up a field by name via querySelector (avoids HTMLFormElement's
    // named-property quirks, e.g. form.method being the built-in attribute).
    function field(name) { return form.querySelector('[name="' + name + '"]'); }

    // "Does it for you": prefill start value + rates from recent logs.
    // force = overwrite even if the user already typed (used on metric change).
    function smartPrefill(force) {
      var snaps = S.getState().channelSnapshots;
      var metricEl = field("metric");
      var metric = metricEl ? metricEl.value : "totalSubs";
      var sug = stats.suggestFromLogs(snaps, metric);
      function set(name, val) {
        var el = field(name);
        if (el && (force || !el.value)) el.value = val;
      }
      if (sug) {
        set("startValue", Math.round(sug.current));
        set("weeklyPct", round1(sug.weeklyPct * 100));
        set("manualRate", round1(sug.perDay));
        set("worstRate", round1(sug.worst));
        set("likelyRate", round1(sug.likely));
        set("bestRate", round1(sug.best));
      } else if (snaps.length) {
        set("startValue", Math.round(Number(snaps[snaps.length - 1][metric]) || 0));
      }
    }

    $("#predictMethod").addEventListener("change", toggleMethod);
    $("#predictMetric").addEventListener("change", function () {
      if ($("#predictMethod").value !== "auto") smartPrefill(true);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = formData(form);
      var snaps = S.getState().channelSnapshots;
      var today = new Date().toISOString().slice(0, 10);
      var target = Number(d.target);
      var tDate = d.targetDate;
      var start = (d.startValue !== "" && d.startValue != null)
        ? Number(d.startValue)
        : (snaps.length ? Number(snaps[snaps.length - 1][d.metric]) || 0 : 0);
      var r;
      switch (d.method) {
        case "compound":
          if (!d.weeklyPct) { toast("Enter a weekly % growth.", true); return; }
          r = stats.forecastCompound(start, Number(d.weeklyPct) / 100, today, tDate, target, d.metric);
          break;
        case "scenarios":
          if (!d.likelyRate) { toast("Enter at least a 'likely per day' rate.", true); return; }
          r = stats.forecastScenarios(start, Number(d.worstRate), Number(d.likelyRate), Number(d.bestRate), today, tDate, target, d.metric);
          break;
        case "posting":
          if (!d.uploadsPerWeek || !d.perUpload) { toast("Enter uploads/week and gain per upload.", true); return; }
          r = stats.forecastFromPosting(start, Number(d.uploadsPerWeek), Number(d.perUpload), today, tDate, target, d.metric);
          break;
        case "steady":
          if (!d.manualRate) { toast("Enter your average per day.", true); return; }
          r = stats.forecastFromAverage(start, Number(d.manualRate), today, tDate, target, d.metric);
          break;
        case "auto":
        default:
          r = stats.forecast(snaps, d.metric, tDate, target, { method: "auto" });
      }
      lastPredict = r;
      showPredict(r);
    });

    toggleMethod(); // set initial field visibility (Smart hides the manual inputs)
  }

  function showPredict(r) {
    var box = $("#predictResult");
    if (!r.ok) {
      box.classList.remove("hidden");
      $("#probPct").textContent = "—";
      $("#probHeadline").textContent = "Not enough data";
      $("#probRange").textContent = "";
      $("#predictExplain").innerHTML = "<p>" + r.reason + "</p>";
      charts.destroyAll();
      return;
    }
    box.classList.remove("hidden");
    var pct = Math.round(r.probability * 100);
    var circle = $("#probCircle");
    circle.style.setProperty("--pct", pct);
    circle.style.setProperty("--col", pct >= 70 ? "var(--accent-2)" : (pct >= 40 ? "var(--warn)" : "var(--danger)"));
    $("#probPct").textContent = r.alreadyHit ? "✓" : pct + "%";
    $("#probHeadline").textContent = r.alreadyHit
      ? "Target already reached!"
      : "~" + pct + "% chance by " + explain.prettyDate(r.targetDate);
    $("#probRange").textContent = r.alreadyHit ? "" :
      "Expected ≈ " + fmt(r.expected) + " (range " + fmt(r.low) + "–" + fmt(r.high) + ")";
    $("#predictExplain").innerHTML = explain.explainForecast(r);
    drawPredictChart(r);
    scrollTo(box);
  }
  function drawPredictChart(r) { charts.projection("predictChart", r); }

  /* ================= CHARTS ================= */
  function wireCharts() {
    $("#chartMetric").addEventListener("change", renderCharts);
  }
  function renderCharts() {
    var st = S.getState();
    var snaps = st.channelSnapshots;
    if (!snaps.length) return;
    var metric = $("#chartMetric").value;
    var labelMap = {
      totalSubs: "Subscribers", longformViews: "Long-form views",
      watchHoursTotal: "Watch hours", shortsViews90d: "Shorts views (90d)"
    };
    var colorMap = {
      totalSubs: "--brand", longformViews: "--long",
      watchHoursTotal: "--accent-2", shortsViews90d: "--shorts"
    };
    charts.trend("trendChart",
      snaps.map(function (s) { return explain.prettyDate(s.date); }),
      snaps.map(function (s) { return Number(s[metric]) || 0; }),
      labelMap[metric], colorMap[metric]);

    var latest = snaps[snaps.length - 1];
    var rev = mon.estimateRevenue(latest);
    charts.revenue("revenueChart", rev.longRevenue, rev.shortsRevenue);
  }

  /* ================= GOALS ================= */
  var whatifScenarios = null;
  var SUB_MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];

  function goalCurrentValue() {
    var el = $("#goalCurrent");
    if (el && el.value !== "") return Number(el.value) || 0;
    var latest = S.latestSnapshot();
    return latest ? Number(latest.totalSubs) || 0 : 0;
  }

  function relativeWhen(dateStr) {
    if (!dateStr) return "";
    var today = new Date().toISOString().slice(0, 10);
    var d = stats.daysBetween(today, dateStr);
    if (d <= 0) return "reached";
    if (d < 60) return "in ~" + d + " days";
    if (d < 730) return "in ~" + Math.round(d / 30) + " months";
    return "in ~" + (Math.round(d / 36.5) / 10) + " years";
  }

  // The steady daily rate implied by the chosen mode (for the assumption line).
  function goalPerDay() {
    var mode = $("#goalMode").value;
    if (mode === "pct") return null; // compounding — not a flat per-day number
    if (mode === "perDay") return Number($("#goalRate").value) || 0;
    var sug = stats.suggestFromLogs(S.getState().channelSnapshots, "totalSubs");
    return sug ? Math.max(0, sug.perDay) : 0; // auto = recent average pace
  }

  // Returns function(targetValue) -> etaDate string | null, per the chosen mode.
  // NOTE: "auto" extrapolates your RECENT PACE steadily (so every milestone gets
  // a date) rather than a best-fit curve that could plateau below big milestones.
  function goalEtaFn() {
    var mode = $("#goalMode").value;
    var today = new Date().toISOString().slice(0, 10);
    var far = stats.addDays(today, 3650 * 3);
    var current = goalCurrentValue();
    if (mode === "pct") {
      var pct = Number($("#goalPct").value) || 0;
      return function (v) { var r = stats.forecastCompound(current, pct / 100, today, far, v, "totalSubs"); return r.ok ? r.etaDate : null; };
    }
    var rate = goalPerDay();
    return function (v) { var r = stats.forecastFromAverage(current, rate, today, far, v, "totalSubs"); return r.ok ? r.etaDate : null; };
  }

  function renderMilestonesAndMon() {
    var current = goalCurrentValue();
    var mode = $("#goalMode").value;
    var snaps = S.getState().channelSnapshots;

    // Plain-English line describing the assumption behind the dates.
    var assume;
    if (mode === "pct") {
      assume = "assuming " + (Number($("#goalPct").value) || 0) + "% growth per week (compounding)";
    } else if (mode === "perDay") {
      assume = "assuming a steady " + explain.fmtRate(Number($("#goalRate").value) || 0) + " subs/day";
    } else {
      var pd = goalPerDay();
      assume = snaps.length >= 2
        ? "assuming you keep gaining about " + explain.fmtRate(pd) + " subs/day (your recent pace)"
        : null;
    }

    var html;
    if (mode === "auto" && snaps.length < 2) {
      html = "<p class='muted'>Add 2+ logged snapshots for automatic ETAs, or switch \"Based on\" to a rate you type.</p>";
    } else if ((mode !== "pct") && goalPerDay() <= 0 && mode !== "perDay") {
      html = "<p class='muted'>Your recent trend isn't growing, so there's no ETA. Log more snapshots or switch to a manual rate.</p>";
    } else {
      var etaOf = goalEtaFn();
      var rows = "<div class='milestone'><span>Now</span><span class='eta'>" + fmt(current) + " subs</span></div>";
      rows += SUB_MILESTONES.filter(function (v) { return v > current; }).map(function (v) {
        var eta = etaOf(v);
        var when = eta ? explain.prettyDate(eta) + " <span class='muted'>(" + relativeWhen(eta) + ")</span>" : "<span class='muted'>—</span>";
        return "<div class='milestone'><span>" + fmt(v) + " subs</span><span class='eta'>" + when + "</span></div>";
      }).join("");
      html = (assume ? "<p class='muted' style='margin-bottom:10px'>📅 Estimated dates " + assume + ".</p>" : "") + rows;
    }
    $("#milestoneTimeline").innerHTML = html;
    renderMonForecast();
  }

  function renderMonForecast() {
    var snaps = S.getState().channelSnapshots;
    var box = $("#monetizationForecast");
    if (snaps.length < 2) {
      box.innerHTML = "<p class='muted'>Log at least 2 snapshots (Daily Log) to forecast your monetization date and revenue.</p>";
      return;
    }
    var today = new Date().toISOString().slice(0, 10);
    var far = stats.addDays(today, 3650);
    function eta(metric, target) { var r = stats.forecast(snaps, metric, far, target, { method: "auto" }); return r.ok ? r.etaDate : null; }
    function laterOf(a, b) { if (!a || !b) return null; return a > b ? a : b; }       // need BOTH
    function earlierOf(a, b) { if (!a) return b; if (!b) return a; return a < b ? a : b; } // need ONE

    var latest = S.latestSnapshot();
    var ev = mon.evaluate(latest);

    function tierRow(label, tier, subT, watchT, shortsT) {
      if (tier.unlocked) return "<div class='milestone'><span>" + label + "</span><span class='eta'>✅ Already unlocked</span></div>";
      var subsDate = eta("totalSubs", subT);
      var watchDate = eta("watchHoursTotal", watchT);
      var shortsDate = eta("shortsViews90d", shortsT);
      var pathDate = earlierOf(watchDate, shortsDate);
      var pathName = pathDate ? (pathDate === watchDate ? "watch-hours path" : "Shorts path") : null;
      var finalDate = laterOf(subsDate, pathDate);
      var txt = finalDate
        ? explain.prettyDate(finalDate) + " <span class='muted'>(" + relativeWhen(finalDate) + ", via " + pathName + ")</span>"
        : "<span class='muted'>not on current pace</span>";
      return "<div class='milestone'><span>" + label + "</span><span class='eta'>" + txt + "</span></div>";
    }

    var html = "";
    html += tierRow("Fan Funding (500 subs + path)", ev.fanFunding, 500, 3000, 3000000);
    html += tierRow("Ad Revenue (1,000 subs + path)", ev.adRevenue, 1000, 4000, 10000000);

    var sugLong = stats.suggestFromLogs(snaps, "longformViews");
    var sugShorts = stats.suggestFromLogs(snaps, "shortsViews90d");
    var longPerDay = sugLong ? Math.max(0, sugLong.perDay) : 0;
    var shortsPerDay = sugShorts ? Math.max(0, sugShorts.perDay) : 0;
    var longMo = longPerDay * 30 / 1000 * (Number(latest.longRPM) || 0);
    var shortsMo = shortsPerDay * 30 / 1000 * (Number(latest.shortsRPM) || 0);
    var totalMo = longMo + shortsMo;
    var monetized = ev.adRevenue.unlocked;
    var money = function (v, d) { return "$" + v.toLocaleString("en-US", { maximumFractionDigits: d == null ? 0 : d }); };
    html += "<div class='milestone' style='margin-top:10px'><span>Est. monthly revenue" + (monetized ? " at current pace" : " once monetized") +
      "</span><span class='eta'>" + (monetized ? money(totalMo) : "$0 now") + "</span></div>";
    if (monetized) {
      html += "<p class='muted'>Long-form ≈ " + money(longMo) + "/mo · Shorts ≈ " + money(shortsMo, 2) + "/mo. Shorts earn far less per view — that gap is normal.</p>";
    } else {
      html += "<p class='muted'>🔒 You're <strong>not monetized yet</strong>, so ad revenue is <strong>$0 today</strong>. Once you qualify you'd earn about <strong>" + money(totalMo) + "/mo</strong> at this pace (long-form ≈ " + money(longMo) + ", Shorts ≈ " + money(shortsMo, 2) + "). Shorts earn far less per view — that gap is normal.</p>";
    }
    box.innerHTML = html;
  }

  function ensureScenarios() {
    if (whatifScenarios) return;
    var sug = stats.suggestFromLogs(S.getState().channelSnapshots, "totalSubs");
    var base = sug ? Math.max(1, Math.round(sug.perDay * 10) / 10) : 5;
    whatifScenarios = [
      { label: "Current pace", rate: base },
      { label: "Double effort", rate: Math.round(base * 2 * 10) / 10 }
    ];
  }

  function renderWhatifRows() {
    ensureScenarios();
    var box = $("#whatifRows");
    box.innerHTML = whatifScenarios.map(function (s, i) {
      return "<div class='whatif-row' data-i='" + i + "'>" +
        "<input type='text' class='wf-label' value='" + esc(s.label) + "' placeholder='Scenario name' />" +
        "<input type='number' class='wf-rate' value='" + s.rate + "' min='0' step='0.1' /><span class='muted'>subs/day</span>" +
        (whatifScenarios.length > 1 ? "<button type='button' class='row-del wf-del' title='Remove'>✕</button>" : "") +
        "</div>";
    }).join("");
    $$(".whatif-row", box).forEach(function (row) {
      var i = Number(row.getAttribute("data-i"));
      row.querySelector(".wf-label").addEventListener("input", function () { whatifScenarios[i].label = this.value; drawWhatifChart(); });
      row.querySelector(".wf-rate").addEventListener("input", function () { whatifScenarios[i].rate = Number(this.value) || 0; drawWhatifChart(); });
      var del = row.querySelector(".wf-del");
      if (del) del.addEventListener("click", function () { whatifScenarios.splice(i, 1); renderWhatifRows(); drawWhatifChart(); });
    });
  }

  function drawWhatifChart() {
    ensureScenarios();
    var current = goalCurrentValue();
    var today = new Date().toISOString().slice(0, 10);
    var dates = [], xs = [];
    for (var x = 0; x <= 365; x += 14) { dates.push(explain.prettyDate(stats.addDays(today, x))); xs.push(x); }
    var series = whatifScenarios.map(function (s) {
      return { label: s.label + " (+" + s.rate + "/day)", data: xs.map(function (x) { return current + s.rate * x; }) };
    });
    charts.multiLine("whatifChart", dates, series);
  }

  function renderGoals() {
    renderGoalsList();
    renderMilestonesAndMon();
    renderWhatifRows();
    drawWhatifChart();
  }

  function toggleGoalMode() {
    var mode = $("#goalMode").value;
    $$(".gfield").forEach(function (el) {
      var modes = (el.getAttribute("data-modes") || "").split(" ");
      el.classList.toggle("hidden", modes.indexOf(mode) === -1);
    });
  }

  function wireGoals() {
    var snaps = S.getState().channelSnapshots;
    var latest = S.latestSnapshot();
    if (latest) $("#goalCurrent").value = Math.round(Number(latest.totalSubs) || 0);
    var sug = stats.suggestFromLogs(snaps, "totalSubs");
    if (sug) { $("#goalRate").value = Math.round(sug.perDay * 10) / 10; $("#goalPct").value = Math.round(sug.weeklyPct * 1000) / 10; }
    else { $("#goalRate").value = 5; $("#goalPct").value = 5; }
    $("#goalMode").value = snaps.length >= 2 ? "auto" : "perDay";
    toggleGoalMode();

    $("#goalMode").addEventListener("change", function () { toggleGoalMode(); renderMilestonesAndMon(); });
    ["goalCurrent", "goalRate", "goalPct"].forEach(function (id) {
      $("#" + id).addEventListener("input", function () { renderMilestonesAndMon(); drawWhatifChart(); });
    });
    $("#addScenario").addEventListener("click", function () {
      ensureScenarios();
      whatifScenarios.push({ label: "Scenario " + (whatifScenarios.length + 1), rate: 8 });
      renderWhatifRows(); drawWhatifChart();
    });
  }

  /* ================= BACKUP ================= */
  function wireBackup() {
    $("#exportJSON").addEventListener("click", function () {
      download("youtube-tracker-backup.json", S.exportJSON(), "application/json");
      toast("JSON backup downloaded.");
    });
    $("#exportCSV").addEventListener("click", function () {
      download("youtube-snapshots.csv", S.exportCSV(), "text/csv");
      toast("CSV downloaded.");
    });
    $("#importFile").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          S.importJSON(reader.result);
          toast("Backup restored.");
          applyTheme(S.getState().settings.theme);
          renderAll();
        } catch (err) {
          toast("That file isn't a valid backup.", true);
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    });
    $("#importCSVFile").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var n = S.importCSV(reader.result);
          toast("Imported " + n + " snapshot" + (n === 1 ? "" : "s") + " from CSV.");
          renderAll();
        } catch (err) {
          toast("Couldn't read that CSV: " + err.message, true);
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    });
    $("#loadSample").addEventListener("click", function () {
      if (!confirm("Replace current data with the sample data?")) return;
      S.reset();
      applyTheme(S.getState().settings.theme);
      renderAll();
      toast("Sample data loaded.");
    });
    $("#clearAll").addEventListener("click", function () {
      if (!confirm("Delete ALL your data? This can't be undone (export a backup first!).")) return;
      S.clear();
      renderAll();
      toast("All data cleared.");
    });
  }

  /* ================= utilities ================= */
  function formData(form) {
    var obj = {};
    $$("input, select, textarea", form).forEach(function (el) {
      if (!el.name) return;
      obj[el.name] = el.value;
    });
    return obj;
  }
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Safe scroll — some environments (and older browsers) lack scrollIntoView.
  function scrollTo(el) {
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
})();
