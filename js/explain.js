/* ============================================================
   explain.js — turns raw model numbers into plain English.
   Goal: anyone, non-technical, understands the forecast.
   ============================================================ */
(function () {
  "use strict";

  var METRIC_NAMES = {
    totalSubs: "subscribers",
    longformViews: "long-form views",
    watchHoursTotal: "watch hours",
    shortsViews90d: "Shorts engaged views (90-day)"
  };

  function fmt(n) {
    n = Math.round(Number(n) || 0);
    return n.toLocaleString("en-US");
  }
  function fmtRate(n) {
    n = Number(n) || 0;
    var abs = Math.abs(n);
    var d = abs >= 100 ? 0 : (abs >= 10 ? 1 : 2);
    return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
  }
  function prettyDate(dateStr) {
    if (!dateStr) return "—";
    var d = new Date(dateStr + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  // Durations are typed the way YouTube Studio shows them ("4:32", "0:18"),
  // but a plain seconds number is accepted too. Stored as seconds.
  function parseDuration(input) {
    if (input === null || input === undefined) return 0;
    var s = String(input).trim();
    if (!s) return 0;
    var parts = s.split(":"), total = 0, ok = true;
    parts.forEach(function (p) {
      var n = Number(p.trim());
      if (p.trim() === "" || isNaN(n) || n < 0) ok = false;
      total = total * 60 + (n || 0);
    });
    return ok ? Math.round(total) : 0;
  }
  function fmtDuration(sec) {
    sec = Math.round(Number(sec) || 0);
    if (sec <= 0) return "—";
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }
  function fmtPct(n, dp) {
    n = Number(n) || 0;
    if (n <= 0) return "—";
    var f = Math.pow(10, dp == null ? 1 : dp);
    return (Math.round(n * f) / f) + "%";
  }

  // How good is the fit, in words?
  function r2Quality(r2) {
    if (r2 === null || r2 === undefined) return null;
    if (r2 >= 0.95) return "a very strong match";
    if (r2 >= 0.85) return "a strong match";
    if (r2 >= 0.7) return "a decent match";
    if (r2 >= 0.4) return "a rough match";
    return "a weak match — treat this as a loose guess";
  }

  function probWord(p) {
    var pct = p * 100;
    if (pct >= 90) return "almost certain";
    if (pct >= 70) return "likely";
    if (pct >= 45) return "a coin-flip-ish chance";
    if (pct >= 20) return "possible but a stretch";
    return "unlikely at the current pace";
  }

  // Main: build an HTML explanation string from a forecast result.
  function explainForecast(r) {
    if (!r.ok) return "<p>" + r.reason + "</p>";
    var name = METRIC_NAMES[r.field] || r.field;
    var pct = Math.round(r.probability * 100);
    var parts = [];

    if (r.alreadyHit) {
      parts.push("<p>🎉 You've <strong>already passed</strong> your target of <strong>" +
        fmt(r.target) + " " + name + "</strong> (you're at " + fmt(r.lastValue) +
        " as of " + prettyDate(r.lastDate) + "). Time to set a bigger goal!</p>");
      return parts.join("");
    }

    // 1) How it's growing right now
    var dir = r.perDayNow >= 0 ? "growing" : "shrinking";
    var modelBit = r.usedManual
      ? "using <span class='tag'>" + r.modelLabel + "</span>"
      : "based on a <span class='tag'>" + r.modelLabel + "</span> pattern";
    var qual = r2Quality(r.r2);
    var qualBit = qual ? " (" + qual + ")" : "";
    parts.push("<p>Your <strong>" + name + "</strong> are " + dir + " about <strong>" +
      fmtRate(r.perDayNow) + "/day</strong> right now, " + modelBit + qualBit + ".</p>");

    // 2) When you'd hit the target
    if (r.etaDate) {
      parts.push("<p>At this pace you'd reach <strong>" + fmt(r.target) + " " + name +
        "</strong> around <strong>" + prettyDate(r.etaDate) + "</strong>.</p>");
    } else {
      parts.push("<p>At this pace, the target of <strong>" + fmt(r.target) + " " + name +
        "</strong> isn't reached within a sensible timeframe — you'd need to speed up.</p>");
    }

    // 3) Probability by the chosen date, with the range
    parts.push("<p>By <strong>" + prettyDate(r.targetDate) + "</strong>, the model expects roughly <strong>" +
      fmt(r.expected) + "</strong> " + name + " — most likely between <strong>" +
      fmt(r.low) + "</strong> and <strong>" + fmt(r.high) + "</strong>. That puts your chance of hitting <strong>" +
      fmt(r.target) + "</strong> by then at about <strong>" + pct + "%</strong> — " + probWord(r.probability) + ".</p>");

    // 4) Plain-language caveat about what the % means
    if (r.model === "scenarios") {
      parts.push("<p class='muted'>The shaded range is <strong>your own</strong> worst-to-best guess; the % treats your \"likely\" rate as the middle and your worst/best as the edges. Widen or narrow those three numbers to reflect how sure you feel.</p>");
    } else if (r.usedManual) {
      parts.push("<p class='muted'>No logs needed here — this is built straight from the numbers you entered. The % assumes your real day-to-day results wobble a bit around that (a steady channel is more predictable than a spiky one), and the range widens the further out you look. Log a few real snapshots and switch to <strong>🤖 Smart</strong> for a sharper, data-driven forecast.</p>");
    } else {
      parts.push("<p class='muted'>The range and % come from how bumpy your past data is: steadier history → tighter range and a more confident %. Forecasts far in the future are naturally less certain.</p>");
    }

    return parts.join("");
  }

  // Short one-liner for milestone rows on the dashboard.
  function milestoneLine(label, etaDate, prob) {
    var when = etaDate ? prettyDate(etaDate) : "not on current pace";
    return { label: label, eta: when, prob: prob };
  }

  window.YT = window.YT || {};
  window.YT.explain = {
    metricName: function (f) { return METRIC_NAMES[f] || f; },
    fmt: fmt,
    fmtRate: fmtRate,
    prettyDate: prettyDate,
    parseDuration: parseDuration,
    fmtDuration: fmtDuration,
    fmtPct: fmtPct,
    r2Quality: r2Quality,
    probWord: probWord,
    explainForecast: explainForecast,
    milestoneLine: milestoneLine
  };
})();
