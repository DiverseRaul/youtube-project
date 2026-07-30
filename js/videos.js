/* ============================================================
   videos.js — per-video helpers (long vs short kept distinct)
   ============================================================ */
(function () {
  "use strict";

  var stats = window.YT.stats;

  // Average view duration as a share of the video's length. Capped at 100 —
  // YouTube's averages can drift slightly above the length on loops/replays.
  function percentViewed(video, snap) {
    var len = video && Number(video.durationSec) || 0;
    var avg = snap && Number(snap.avgViewDurationSec) || 0;
    if (!len || !avg) return 0;
    return Math.min(100, avg / len * 100);
  }

  // Summary numbers for one video from its (date-sorted) snapshots.
  function summary(video, snaps) {
    if (!snaps.length) {
      return {
        latestViews: 0, viewsPerDay: 0, totalWatchHours: 0, days: 0,
        latestEngagedViews: 0, avgViewDurationSec: 0, stayedToWatch: 0,
        subsGained: 0, percentViewed: 0, hasData: false
      };
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
      // Long-form only; Shorts store 0 here by design.
      totalWatchHours: last.watchHours || 0,
      // Shorts only: the count that actually feeds monetization, plus the hook rate.
      latestEngagedViews: last.engagedViews || 0,
      stayedToWatch: last.stayedToWatch || 0,
      // Both types.
      avgViewDurationSec: last.avgViewDurationSec || 0,
      subsGained: last.subsGained || 0,
      // Share of the video people watch on average — needs the video's length.
      percentViewed: percentViewed(video, last),
      viewsPerDay: perDay,
      days: days,
      hasData: true
    };
  }

  // Points for charting a single video's view growth.
  function viewPoints(snaps) {
    return snaps.map(function (s) { return { date: s.date, y: s.views }; });
  }

  /* ---- Copy-paste export ----------------------------------------------
     One block per video, as labelled "Key: value" lines plus a pipe table
     of history. Readable at a glance, and unambiguous enough to paste into
     an AI chat and ask questions about it. Plain text only — no HTML. */
  function videoBlock(video, snaps, today, index, total) {
    var E = window.YT.explain;
    var sum = summary(video, snaps);
    var last = snaps.length ? snaps[snaps.length - 1] : null;
    var isShort = video.type === "short";
    var L = [];

    L.push("### Video " + index + " of " + total + ": " + video.title);
    L.push("Type: " + (isShort ? "Short (vertical, <3 min)" : "Long-form"));
    L.push("Length: " + (video.durationSec ? E.fmtDuration(video.durationSec) + " (" + video.durationSec + "s)" : "not logged"));
    var when = "Uploaded: " + (video.publishDate || "unknown");
    if (video.publishTime) when += " at " + video.publishTime;
    if (video.publishDate) {
      var age = stats.daysBetween(video.publishDate, today);
      when += " (" + (age <= 0 ? "today" : age + " day" + (age === 1 ? "" : "s") + " ago") + ")";
    }
    L.push(when);
    L.push("Description: " + (video.description || "(none given)"));

    if (!last) {
      L.push("Stats: no readings logged yet.");
      return L.join("\n");
    }

    L.push("Stats as of " + last.date + ":");
    L.push("- Views: " + E.fmt(last.views));
    if (isShort) {
      L.push("- Engaged views: " + (last.engagedViews ? E.fmt(last.engagedViews) : "not logged") +
        (last.engagedViews && last.views ? " (" + E.fmtPct(last.engagedViews / last.views * 100, 0) + " of public views)" : ""));
    }
    L.push("- Views per day since upload: " + E.fmtRate(sum.viewsPerDay));
    L.push("- Subscribers gained: " + (last.subsGained ? E.fmt(last.subsGained) +
      (last.views ? " (" + E.fmtRate(last.subsGained / last.views * 1000) + " per 1,000 views)" : "") : "not logged"));
    L.push("- Likes: " + E.fmt(last.likes) +
      (last.views && last.likes ? " (" + E.fmtPct(last.likes / last.views * 100, 2) + " of views)" : ""));
    L.push("- Comments: " + E.fmt(last.comments) +
      (last.views && last.comments ? " (" + E.fmtPct(last.comments / last.views * 100, 2) + " of views)" : ""));
    L.push("- Average view duration: " + E.fmtDuration(last.avgViewDurationSec) +
      (last.avgViewDurationSec ? " (" + last.avgViewDurationSec + "s)" : "") +
      (sum.percentViewed ? " — " + E.fmtPct(sum.percentViewed, 0) + " of the video" : ""));
    if (isShort) {
      L.push("- Stayed to watch: " + E.fmtPct(last.stayedToWatch));
    } else {
      L.push("- Watch hours: " + (last.watchHours ? E.fmtRate(last.watchHours) : "not logged"));
    }

    // Growth between the two most recent readings — the "is it still moving?" line.
    if (snaps.length > 1) {
      var prev = snaps[snaps.length - 2];
      var dv = last.views - prev.views;
      var days = Math.max(1, stats.daysBetween(prev.date, last.date));
      L.push("- Recent growth: " + (dv >= 0 ? "+" : "") + E.fmt(dv) + " views between " + prev.date +
        " and " + last.date + " (" + E.fmtRate(dv / days) + "/day)");
    }

    if (snaps.length > 1) {
      var head = isShort
        ? ["date", "views", "engaged views", "subs gained", "likes", "comments", "avg view duration", "stayed to watch"]
        : ["date", "views", "subs gained", "likes", "comments", "avg view duration", "watch hours"];
      L.push("History (" + snaps.length + " readings):");
      L.push("  " + head.join(" | "));
      snaps.forEach(function (s) {
        var row = isShort
          ? [s.date, s.views, s.engagedViews || 0, s.subsGained || 0, s.likes, s.comments, E.fmtDuration(s.avgViewDurationSec), E.fmtPct(s.stayedToWatch)]
          : [s.date, s.views, s.subsGained || 0, s.likes, s.comments, E.fmtDuration(s.avgViewDurationSec), s.watchHours || 0];
        L.push("  " + row.join(" | "));
      });
    }
    return L.join("\n");
  }

  // Full pasteable report for the chosen videos.
  function exportText(videos, snapsOf, today, opts) {
    opts = opts || {};
    if (!videos.length) return "";
    var head = [
      "# YouTube video stats",
      "Exported: " + today + " · " + videos.length + " video" + (videos.length === 1 ? "" : "s"),
      ""
    ];
    if (opts.includeLegend !== false) {
      head.push(
        "Notes on the numbers (so they aren't misread):",
        "- Values are running totals as of each reading date, not per-day amounts.",
        "- \"Engaged views\" (Shorts only) is YouTube's strict count used for monetization — always lower than the public view count.",
        "- \"Stayed to watch\" (Shorts only) is the share of viewers who did not swipe away in the first seconds.",
        "- \"Watch hours\" applies to long-form only; it is not tracked for Shorts.",
        "- \"Subscribers gained\" is how many subs that single video brought in.",
        "- Durations are mm:ss. \"% of the video\" = average view duration ÷ video length.",
        ""
      );
    }
    var blocks = videos.map(function (v, i) {
      return videoBlock(v, snapsOf(v.id), today, i + 1, videos.length);
    });
    return head.join("\n") + "\n" + blocks.join("\n\n") + "\n";
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
    splitByType: splitByType,
    percentViewed: percentViewed,
    videoBlock: videoBlock,
    exportText: exportText
  };
})();
