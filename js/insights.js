/* ============================================================
   insights.js — turn logged data into advice.
   Pure functions (testable): best time/day to post + leaderboard.
   ============================================================ */
(function () {
  "use strict";
  var stats = window.YT.stats;

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var BUCKETS = [
    { key: "Morning", label: "Morning (5–11)" },
    { key: "Afternoon", label: "Afternoon (12–16)" },
    { key: "Evening", label: "Evening (17–21)" },
    { key: "Night", label: "Night (22–4)" }
  ];

  function timeBucket(t) {
    if (!t) return null;
    var h = parseInt(String(t).split(":")[0], 10);
    if (isNaN(h)) return null;
    if (h >= 5 && h <= 11) return "Morning";
    if (h >= 12 && h <= 16) return "Afternoon";
    if (h >= 17 && h <= 21) return "Evening";
    return "Night";
  }
  function weekday(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr + "T12:00:00Z").getUTCDay();
  }

  // Performance of one video from its latest reading, normalized by age.
  function videoPerf(video, snaps, today) {
    var last = snaps.length ? snaps[snaps.length - 1] : null;
    var views = last ? Number(last.views) || 0 : 0;
    var likes = last ? Number(last.likes) || 0 : 0;
    var comments = last ? Number(last.comments) || 0 : 0;
    var daysLive = video.publishDate ? Math.max(1, stats.daysBetween(video.publishDate, today)) : 1;
    var isShort = video.type === "short";
    var engaged = last ? Number(last.engagedViews) || 0 : 0;
    return {
      hasData: !!last,
      latestViews: views,
      viewsPerDay: views / daysLive,
      daysLive: daysLive,
      likeRate: views > 0 ? likes / views * 100 : 0,
      commentRate: views > 0 ? comments / views * 100 : 0,
      engagementRate: views > 0 ? (likes + comments) / views * 100 : 0,
      // Retention: comparable across both types.
      avgViewDurationSec: last ? Number(last.avgViewDurationSec) || 0 : 0,
      // Shorts-only signals.
      engagedViews: isShort ? engaged : 0,
      stayedToWatch: isShort && last ? Number(last.stayedToWatch) || 0 : 0,
      // What share of public views YouTube counted as engaged (Shorts only).
      engagedShare: isShort && views > 0 ? engaged / views * 100 : 0,
      // Long-form only.
      watchHours: !isShort && last ? Number(last.watchHours) || 0 : 0
    };
  }

  // Average views/day grouped by weekday and by time-of-day bucket.
  function bestPostAnalysis(videos, snapsOf, today) {
    var wk = {}, tm = {}, count = 0;
    videos.forEach(function (vid) {
      var p = videoPerf(vid, snapsOf(vid.id), today);
      if (!p.hasData || !vid.publishDate) return;
      count++;
      var wd = weekday(vid.publishDate);
      if (wd != null) (wk[wd] = wk[wd] || []).push(p.viewsPerDay);
      var tb = timeBucket(vid.publishTime);
      if (tb) (tm[tb] = tm[tb] || []).push(p.viewsPerDay);
    });
    function avg(arr) { return arr.reduce(function (s, x) { return s + x; }, 0) / arr.length; }
    var byWeekday = [0, 1, 2, 3, 4, 5, 6].filter(function (k) { return wk[k]; })
      .map(function (k) { return { label: WEEKDAYS[k], avg: avg(wk[k]), n: wk[k].length }; });
    var byTime = BUCKETS.filter(function (b) { return tm[b.key]; })
      .map(function (b) { return { label: b.label, avg: avg(tm[b.key]), n: tm[b.key].length }; });
    function best(list) { return list.length ? list.slice().sort(function (a, b) { return b.avg - a.avg; })[0] : null; }
    return { byWeekday: byWeekday, byTime: byTime, bestDay: best(byWeekday), bestTime: best(byTime), count: count };
  }

  // Videos ranked by the chosen metric (only those with a reading).
  function leaderboard(videos, snapsOf, today, metric) {
    metric = metric || "viewsPerDay";
    return videos
      .map(function (vid) { return { video: vid, perf: videoPerf(vid, snapsOf(vid.id), today) }; })
      .filter(function (r) { return r.perf.hasData; })
      .sort(function (a, b) { return (b.perf[metric] || 0) - (a.perf[metric] || 0); });
  }

  window.YT = window.YT || {};
  window.YT.insights = {
    timeBucket: timeBucket,
    weekday: weekday,
    videoPerf: videoPerf,
    bestPostAnalysis: bestPostAnalysis,
    leaderboard: leaderboard,
    WEEKDAYS: WEEKDAYS,
    BUCKETS: BUCKETS
  };
})();
