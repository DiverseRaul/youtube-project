/* ============================================================
   videos.js — per-video helpers (long vs short kept distinct)
   ============================================================ */
(function () {
  "use strict";

  var stats = window.YT.stats;

  // Summary numbers for one video from its (date-sorted) snapshots.
  function summary(video, snaps) {
    if (!snaps.length) {
      return { latestViews: 0, viewsPerDay: 0, totalWatchHours: 0, days: 0, hasData: false };
    }
    var first = snaps[0], last = snaps[snaps.length - 1];
    var days = stats.daysBetween(first.date, last.date);
    var viewDelta = last.views - first.views;
    var perDay = days > 0 ? viewDelta / days
      : (video.publishDate ? last.views / Math.max(1, stats.daysBetween(video.publishDate, last.date)) : 0);
    return {
      latestViews: last.views,
      latestLikes: last.likes,
      latestComments: last.comments,
      totalWatchHours: last.watchHours,
      viewsPerDay: perDay,
      days: days,
      hasData: true
    };
  }

  // Points for charting a single video's view growth.
  function viewPoints(snaps) {
    return snaps.map(function (s) { return { date: s.date, y: s.views }; });
  }

  // Split a video list by type — used to keep Shorts out of long-form math.
  function splitByType(videos) {
    return {
      long: videos.filter(function (v) { return v.type === "long"; }),
      shorts: videos.filter(function (v) { return v.type === "short"; })
    };
  }

  window.YT = window.YT || {};
  window.YT.videos = {
    summary: summary,
    viewPoints: viewPoints,
    splitByType: splitByType
  };
})();
