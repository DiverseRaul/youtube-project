/* ============================================================
   monetization.js — YouTube Partner Program rules (verified 2026)
   Rules are data-driven so they're easy to update if YouTube changes them.

   CORRECTED FACTS baked in (verified against support.google.com/youtube/answer/72851):
   - Shorts DO count toward monetization. The threshold uses "engaged views"
     (legitimate views counted the old way) — NOT the inflated public view count.
   - Fan Funding tier: 500 subs + 3 public uploads in 90 days
       + (3,000 watch hours/12mo OR 3,000,000 Shorts engaged views/90d).
   - Ad-revenue tier: 1,000 subs + (4,000 watch hours/12mo OR 10,000,000 Shorts engaged views/90d).
   - Shorts and long-form revenue are estimated SEPARATELY (very different RPM).
   ============================================================ */
(function () {
  "use strict";

  var RULES = {
    fanFunding: {
      name: "Fan Funding tier (early access)",
      blurb: "Unlocks memberships, Super Thanks, Shopping & tips — but NOT ad revenue yet. Also requires 3 public uploads in the last 90 days.",
      base: [
        { key: "totalSubs", label: "Subscribers", target: 500, unit: "" }
      ],
      eitherPaths: [
        { key: "watchHoursTotal", label: "Watch hours (past 12 mo)", target: 3000, unit: "hrs", path: "long" },
        { key: "shortsViews90d", label: "Shorts engaged views (past 90 days)", target: 3000000, unit: "views", path: "shorts" }
      ]
    },
    adRevenue: {
      name: "Ad Revenue tier (full monetization)",
      blurb: "Unlocks ad revenue. Needs 1,000 subs AND one of the two paths below.",
      base: [
        { key: "totalSubs", label: "Subscribers", target: 1000, unit: "" }
      ],
      eitherPaths: [
        { key: "watchHoursTotal", label: "Watch hours (past 12 mo)", target: 4000, unit: "hrs", path: "long" },
        { key: "shortsViews90d", label: "Shorts engaged views (past 90 days)", target: 10000000, unit: "views", path: "shorts" }
      ]
    }
  };

  function pct(value, target) {
    if (target <= 0) return 100;
    return Math.max(0, Math.min(100, (value / target) * 100));
  }

  function mkReq(r, v) {
    var val = v(r.key);
    return { label: r.label, value: val, target: r.target, unit: r.unit, pct: pct(val, r.target), done: val >= r.target, key: r.key, path: r.path };
  }

  // A tier = base requirement(s) that ALL must pass, AND any one of eitherPaths.
  function evalTier(rule, v) {
    var base = rule.base.map(function (r) { return mkReq(r, v); });
    var paths = rule.eitherPaths.map(function (r) { return mkReq(r, v); });
    var baseDone = base.every(function (r) { return r.done; });
    var anyPathDone = paths.some(function (r) { return r.done; });
    return { name: rule.name, blurb: rule.blurb, base: base, paths: paths, unlocked: baseDone && anyPathDone };
  }

  // Evaluate progress from the latest snapshot.
  function evaluate(latest) {
    latest = latest || {};
    function v(k) { return Number(latest[k]) || 0; }
    return {
      fanFunding: evalTier(RULES.fanFunding, v),
      adRevenue: evalTier(RULES.adRevenue, v)
    };
  }

  // Estimate revenue — Shorts and long-form kept strictly separate.
  function estimateRevenue(snap) {
    if (!snap) return { longRevenue: 0, shortsRevenue: 0, total: 0 };
    var longRev = (Number(snap.longformViews) || 0) / 1000 * (Number(snap.longRPM) || 0);
    var shortsRev = (Number(snap.shortsViews90d) || 0) / 1000 * (Number(snap.shortsRPM) || 0);
    return { longRevenue: longRev, shortsRevenue: shortsRev, total: longRev + shortsRev };
  }

  // Which requirement keys the app should forecast an ETA for.
  function trackedKeys() {
    return [
      { key: "totalSubs", target: 1000, label: "1,000 subscribers" },
      { key: "watchHoursTotal", target: 4000, label: "4,000 watch hours" },
      { key: "shortsViews90d", target: 10000000, label: "10M Shorts views" }
    ];
  }

  window.YT = window.YT || {};
  window.YT.monetization = {
    RULES: RULES,
    evaluate: evaluate,
    estimateRevenue: estimateRevenue,
    trackedKeys: trackedKeys
  };
})();
