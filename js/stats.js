/* ============================================================
   stats.js — the forecasting "brain"
   Fits linear / exponential / logistic growth, picks the best by R²,
   projects to a target date, and turns that into a probability.
   All functions are pure (easy to reason about / test).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- date helpers (UTC-noon to dodge timezone drift) ---------- */
  function parse(dateStr) { return new Date(dateStr + "T12:00:00Z"); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function addDays(dateStr, n) {
    var d = parse(dateStr);
    d.setUTCDate(d.getUTCDate() + Math.round(n));
    return d.toISOString().slice(0, 10);
  }

  /* ---------- turn snapshots into {x: dayIndex, y: value} points ---------- */
  function toPoints(snapshots, field) {
    if (!snapshots.length) return [];
    var ref = snapshots[0].date;
    return snapshots.map(function (s) {
      return { x: daysBetween(ref, s.date), y: Number(s[field]) || 0, date: s.date };
    });
  }

  /* ---------- normal distribution ---------- */
  function erf(x) {
    var t = 1 / (1 + 0.3275911 * Math.abs(x));
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? y : -y;
  }
  function normalCDF(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  // P(value >= target) given value ~ Normal(mean, sd)
  function probabilityAtLeast(mean, sd, target) {
    if (!(sd > 0)) return mean >= target ? 1 : 0;
    return normalCDF((mean - target) / sd);
  }

  /* ---------- fit quality helpers ---------- */
  function rSquared(pts, predict) {
    var meanY = pts.reduce(function (a, p) { return a + p.y; }, 0) / pts.length;
    var ssRes = 0, ssTot = 0;
    pts.forEach(function (p) {
      var e = p.y - predict(p.x);
      ssRes += e * e;
      ssTot += (p.y - meanY) * (p.y - meanY);
    });
    if (ssTot === 0) return 1;
    return 1 - ssRes / ssTot;
  }
  function residualStd(pts, predict) {
    var ss = 0;
    pts.forEach(function (p) { var e = p.y - predict(p.x); ss += e * e; });
    var dof = Math.max(1, pts.length - 2);
    return Math.sqrt(ss / dof);
  }

  /* ---------- LINEAR: y = a + b·x ---------- */
  function linearFit(pts) {
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; });
    var denom = n * sxx - sx * sx;
    var b = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
    var a = (sy - b * sx) / n;
    var predict = function (x) { return a + b * x; };
    return {
      type: "linear", label: "steady (straight-line) growth",
      predict: predict, params: { a: a, b: b },
      r2: rSquared(pts, predict), residualStd: residualStd(pts, predict),
      slopeAt: function () { return b; },
      solveX: function (target) { return b === 0 ? null : (target - a) / b; }
    };
  }

  /* ---------- MOMENTUM: your recent pace, plus the trend in that pace ------
     Channels don't grow along a perfect straight line, and they very rarely
     level off for good — they build momentum (or lose a bit of it). So rather
     than fitting a curve to all of history, this measures the recent per-day
     pace, measures how that pace has been CHANGING, and carries it forward
     with the change fading out.

     This is deliberately replacing two models that extrapolated badly:
       - a raw exponential fit, which turned a good month into "3 billion
         subscribers by December";
       - a logistic S-curve, which decided subscriber growth was about to
         stop dead and flat-lined the forecast.
     By construction this one can do neither. The acceleration decays
     geometrically, so the pace approaches a ceiling instead of running away;
     and the pace approaches a floor above zero instead of dying. */
  var MOM_PHI = 0.9;          // how fast the acceleration fades, per week
  var MOM_MAX_WEEKLY = 1.12;  // carry forward at most +12%/week of pace growth
  var MOM_MIN_WEEKLY = 0.94;  // ...and at worst -6%/week

  function midX(pts) {
    return pts.reduce(function (a, p) { return a + p.x; }, 0) / pts.length;
  }
  function windowSlope(pts) {
    return pts.length < 2 ? null : linearFit(pts).params.b;
  }

  function momentumFit(pts) {
    var n = pts.length;
    if (n < 3) return null;
    var w = Math.max(2, Math.min(6, Math.round(n / 2)));
    var recent = pts.slice(n - w);
    var prior = pts.slice(Math.max(0, n - 2 * w), n - w);
    var rRecent = windowSlope(recent);
    if (rRecent === null) return null;
    var rPrior = prior.length >= 2 ? windowSlope(prior) : null;

    // Is the pace itself speeding up or slowing down? Expressed per week.
    var g = 1;
    if (rPrior !== null && rPrior > 0 && rRecent > 0) {
      var weeks = Math.max(1, (midX(recent) - midX(prior)) / 7);
      g = Math.pow(rRecent / rPrior, 1 / weeks);
      if (!isFinite(g) || g <= 0) g = 1;
    }
    g = Math.min(MOM_MAX_WEEKLY, Math.max(MOM_MIN_WEEKLY, g));

    var recentLine = linearFit(recent);
    var lastX = pts[n - 1].x;
    // Anchor on the fitted value, not the last raw point, so the projection
    // joins the history line smoothly instead of jumping at the seam.
    var anchor = recentLine.predict(lastX);
    var baseRate = Math.max(0, rRecent);

    // Step forward a day at a time, easing the acceleration out as we go.
    function walk(days) {
      var v = anchor, r = baseRate;
      for (var d = 0; d < days; d++) {
        v += r;
        r *= Math.pow(1 + (g - 1) * Math.pow(MOM_PHI, d / 7), 1 / 7);
      }
      return { value: v, rate: r };
    }
    function predict(x) {
      if (x <= lastX) return recentLine.predict(x);
      return walk(Math.round(x - lastX)).value;
    }
    return {
      type: "momentum",
      label: g > 1.005 ? "your recent pace, still building"
        : (g < 0.995 ? "your recent pace, cooling off slightly" : "your recent pace"),
      predict: predict,
      params: { rate: baseRate, weekly: g },
      // Measured on the recent window — i.e. how steady your recent pace is,
      // which is exactly what the forecast is leaning on.
      r2: rSquared(recent, recentLine.predict),
      residualStd: residualStd(recent, recentLine.predict),
      slopeAt: function (x) { return x <= lastX ? baseRate : walk(Math.round(x - lastX)).rate; },
      solveX: function (target) {
        if (target <= anchor) return lastX;
        if (baseRate <= 0 && g <= 1) return null;
        var v = anchor, r = baseRate;
        for (var d = 0; d < 365 * 20; d++) {
          v += r;
          if (v >= target) return lastX + d + 1;
          r *= Math.pow(1 + (g - 1) * Math.pow(MOM_PHI, d / 7), 1 / 7);
        }
        return null;
      }
    };
  }

  /* ---------- the most this channel could plausibly reach ----------
     A backstop so no model — now or later — can print a number that dwarfs
     anything the channel has ever actually done. Four times your best-ever
     day-rate, sustained every day from here, is already a wild success. */
  function plausibleCap(pts, xTarget) {
    var last = pts[pts.length - 1];
    var maxRate = 0;
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - pts[i - 1].x;
      if (dx > 0) maxRate = Math.max(maxRate, (pts[i].y - pts[i - 1].y) / dx);
    }
    var days = Math.max(0, xTarget - last.x);
    return last.y + Math.max(maxRate * 4, 1) * days + 100;
  }
  /* ---------- how wrong could this be? ----------
     Residual scatter alone makes a tidy history look like a precise future —
     it produced bands like "1,059 to 1,066 subscribers in three months",
     which is a promise no forecast can keep. Whatever the history looks like,
     a projection months out carries real model risk, so the band never
     shrinks below a share of the growth being projected. */
  var SD_GAIN_SHARE = 0.18;   // at least ~18% of the projected gain
  var SD_WALK = 0.3;          // ...and a random-walk term on the pace

  function uncertaintyAt(fit, pts, x, xMax, rangeX) {
    var extrapolation = Math.max(0, (x - xMax) / rangeX);
    var base = fit.residualStd * (1 + 0.5 * Math.min(extrapolation, 4));
    var daysAhead = Math.max(0, x - xMax);
    if (daysAhead === 0) return base;
    var gain = Math.max(0, fit.predict(x) - pts[pts.length - 1].y);
    var floor = Math.max(
      SD_GAIN_SHARE * gain,
      SD_WALK * Math.abs(fit.slopeAt(xMax)) * Math.sqrt(daysAhead)
    );
    return Math.max(base, floor);
  }

  function capFit(fit, cap) {
    return {
      type: fit.type, label: fit.label + ", held to a realistic ceiling",
      predict: function (x) { return Math.min(cap, fit.predict(x)); },
      params: fit.params, r2: fit.r2, residualStd: fit.residualStd,
      slopeAt: fit.slopeAt, solveX: fit.solveX
    };
  }

  /* ---------- pick a model that behaves ---------- */
  function bestFit(pts) {
    var lin = linearFit(pts);
    var mom = momentumFit(pts);
    if (!mom) return lin;
    // If the pace is basically constant, the straight line says the same
    // thing and says it more simply.
    if (Math.abs(mom.params.weekly - 1) < 0.01) return lin;
    return mom;
  }

  /* ---------- high-level forecast used by the UI ---------- */
  // opts: { method: "auto"|"manual", manualRate: number }
  // A target is optional everywhere: without one you still get the projection,
  // just no probability or ETA. Returns null when there's nothing to aim at.
  function cleanTarget(target) {
    if (target === null || target === undefined || target === "") return null;
    var n = Number(target);
    return (isFinite(n) && n > 0) ? n : null;
  }

  function forecast(snapshots, field, targetDate, target, opts) {
    opts = opts || {};
    target = cleanTarget(target);
    var pts = toPoints(snapshots, field);
    if (pts.length < 2) {
      return { ok: false, reason: "Need at least 2 dated snapshots to forecast. Add more in Daily Log." };
    }
    var ref = snapshots[0].date;
    var lastPt = pts[pts.length - 1];
    var xTarget = daysBetween(ref, targetDate);
    var xMax = lastPt.x;

    var fit, usedManual = false;
    if (opts.method === "manual" && isFinite(opts.manualRate)) {
      usedManual = true;
      var rate = Number(opts.manualRate);
      var lastVal = lastPt.y;
      // Central line uses the user's rate, anchored at the last real point.
      var predict = function (x) { return lastVal + rate * (x - xMax); };
      // Borrow uncertainty from a straight-line fit of the real data.
      var lin = linearFit(pts);
      fit = {
        type: "manual", label: "your typed growth rate",
        predict: predict, params: { rate: rate },
        r2: null, residualStd: lin.residualStd,
        slopeAt: function () { return rate; },
        solveX: function (t) { return rate === 0 ? null : xMax + (t - lastVal) / rate; }
      };
    } else {
      fit = bestFit(pts);
    }
    if (!fit) return { ok: false, reason: "Could not fit a growth model to this data." };

    // Sanity check the whole horizon, not just the model's shape: if it lands
    // somewhere this channel could not plausibly reach, drop to the straight
    // line, and if even that is silly, hold it at the ceiling.
    var cap = plausibleCap(pts, Math.max(xTarget, xMax));
    if (!usedManual && fit.predict(xTarget) > cap) {
      var straight = linearFit(pts);
      fit = straight.predict(xTarget) <= cap ? straight : capFit(straight, cap);
    }

    // Uncertainty grows the further we extrapolate beyond known data.
    var rangeX = Math.max(1, xMax - pts[0].x);
    var sd = uncertaintyAt(fit, pts, xTarget, xMax, rangeX);

    var expected = Math.min(cap, fit.predict(xTarget));
    var low = expected - 1.96 * sd;   // ~95% band
    // The optimistic edge of the band gets the same reality check.
    var high = Math.min(cap, expected + 1.96 * sd);
    var probability = target === null ? null : probabilityAtLeast(expected, sd, target);

    // ETA: when does the model first reach the target?
    var etaDate = null;
    if (target !== null) {
      var etaX = fit.solveX(target);
      etaDate = (etaX !== null && isFinite(etaX)) ? addDays(ref, etaX) : null;
      // If already past the target, ETA is effectively now/past.
      if (lastPt.y >= target) etaDate = lastPt.date;
    }

    // Build a smooth projection series from last real date to a bit past target.
    var projStartX = pts[0].x;
    var projEndX = Math.max(xTarget, xMax) + Math.round(rangeX * 0.15);
    var projection = { dates: [], expected: [], low: [], high: [] };
    var step = Math.max(1, Math.round((projEndX - projStartX) / 60));
    for (var x = projStartX; x <= projEndX; x += step) {
      var localCap = plausibleCap(pts, Math.max(x, xMax));
      var e = Math.min(localCap, fit.predict(x));
      var s = uncertaintyAt(fit, pts, x, xMax, rangeX);
      projection.dates.push(addDays(ref, x));
      projection.expected.push(e);
      projection.low.push(x <= xMax ? null : Math.max(0, e - 1.96 * s));   // only show band for the future
      projection.high.push(x <= xMax ? null : Math.min(localCap, e + 1.96 * s));
    }

    return {
      ok: true,
      field: field,
      usedManual: usedManual,
      model: fit.type,
      modelLabel: fit.label,
      r2: fit.r2,
      perDayNow: fit.slopeAt(xMax),
      lastValue: lastPt.y,
      lastDate: lastPt.date,
      target: target,
      hasTarget: target !== null,
      targetDate: targetDate,
      expected: expected,
      low: Math.max(0, low),
      high: high,
      sd: sd,
      probability: probability,
      etaDate: etaDate,
      alreadyHit: target !== null && lastPt.y >= target,
      historical: pts,
      projection: projection
    };
  }

  /* ---------- forecast from a typed average (NO history needed) ----------
     You just tell it: where you are now (start), how many you gain per day
     (ratePerDay), and the target + date. It projects a straight line and
     estimates a probability from a reasonable day-to-day wobble (cv). */
  function forecastFromAverage(start, ratePerDay, fromDate, targetDate, target, field, cv) {
    start = Number(start) || 0;
    ratePerDay = Number(ratePerDay) || 0;
    target = cleanTarget(target);
    cv = (cv === undefined ? 0.35 : cv); // assumed ~35% variation around the average
    var days = daysBetween(fromDate, targetDate);
    if (days < 0) return { ok: false, reason: "Pick a target date in the future." };

    var expected = start + ratePerDay * days;
    // With no history we don't know the real volatility, so model the running
    // total's spread as (variation × rate × √days) — uncertainty grows over time.
    var sd = Math.abs(ratePerDay) * cv * Math.sqrt(Math.max(1, days));
    var low = Math.max(0, expected - 1.96 * sd);
    var high = expected + 1.96 * sd;
    var probability = target === null ? null : probabilityAtLeast(expected, sd, target);

    var etaX = (target !== null && ratePerDay > 0) ? (target - start) / ratePerDay : null;
    var alreadyHit = target !== null && start >= target;
    var etaDate = alreadyHit ? fromDate
      : ((etaX !== null && isFinite(etaX) && etaX >= 0) ? addDays(fromDate, etaX) : null);

    var endX = Math.max(days, etaX || 0);
    endX = Math.round(Math.max(endX, 1) * 1.15);
    var projection = { dates: [], expected: [], low: [], high: [] };
    var step = Math.max(1, Math.round(endX / 60));
    for (var x = 0; x <= endX; x += step) {
      var e = start + ratePerDay * x;
      var s = Math.abs(ratePerDay) * cv * Math.sqrt(Math.max(1, x));
      projection.dates.push(addDays(fromDate, x));
      projection.expected.push(e);
      projection.low.push(x === 0 ? null : Math.max(0, e - 1.96 * s));
      projection.high.push(x === 0 ? null : e + 1.96 * s);
    }

    return {
      ok: true, field: field, usedManual: true,
      model: "manual-average", modelLabel: "your typed daily average",
      r2: null, perDayNow: ratePerDay,
      lastValue: start, lastDate: fromDate,
      target: target, hasTarget: target !== null, targetDate: targetDate,
      expected: expected, low: low, high: high, sd: sd,
      probability: probability, etaDate: etaDate, alreadyHit: alreadyHit,
      historical: [{ x: 0, y: start, date: fromDate }],
      projection: projection
    };
  }

  // Shared builder so every "no history" model returns the same shape.
  function buildResult(o) {
    return {
      ok: true, field: o.field, usedManual: true,
      model: o.model, modelLabel: o.modelLabel,
      r2: null, perDayNow: o.perDayNow,
      lastValue: o.start, lastDate: o.fromDate,
      target: o.target, hasTarget: o.target !== null && o.target !== undefined, targetDate: o.targetDate,
      expected: o.expected, low: o.low, high: o.high, sd: o.sd,
      probability: o.probability, etaDate: o.etaDate, alreadyHit: o.alreadyHit,
      historical: [{ x: 0, y: o.start, date: o.fromDate }],
      projection: o.projection
    };
  }
  // Build a projection series for a value() function over [0, endX].
  function buildProjection(fromDate, endX, value, sdOf) {
    var proj = { dates: [], expected: [], low: [], high: [] };
    var step = Math.max(1, Math.round(endX / 60));
    for (var x = 0; x <= endX; x += step) {
      var e = value(x), s = sdOf(x);
      proj.dates.push(addDays(fromDate, x));
      proj.expected.push(e);
      proj.low.push(x === 0 ? null : Math.max(0, e - 1.96 * s));
      proj.high.push(x === 0 ? null : e + 1.96 * s);
    }
    return proj;
  }

  /* ---------- COMPOUNDING %: value = start·(1+p)^(days/7) ----------
     The realistic "snowball": each week grows by p% of the current base,
     so the curve bends upward over time instead of being a straight line. */
  function forecastCompound(start, weeklyPct, fromDate, targetDate, target, field) {
    start = Number(start) || 0;
    var p = Number(weeklyPct) || 0; // fraction, e.g. 0.05 = +5%/week
    target = cleanTarget(target);
    var days = daysBetween(fromDate, targetDate);
    if (days < 0) return { ok: false, reason: "Pick a target date in the future." };
    var cv = 0.35;
    var value = function (x) { return start * Math.pow(1 + p, x / 7); };
    var sdOf = function (x) { return cv * Math.max(0, value(x) - start); };
    var expected = value(days), sd = sdOf(days);
    var etaX = (target !== null && p > 0 && start > 0 && target > start)
      ? 7 * Math.log(target / start) / Math.log(1 + p)
      : ((target !== null && start >= target) ? 0 : null);
    var alreadyHit = target !== null && start >= target;
    var etaDate = alreadyHit ? fromDate : ((etaX !== null && isFinite(etaX) && etaX >= 0) ? addDays(fromDate, etaX) : null);
    var endX = Math.round(Math.max(days, etaX || 0, 1) * 1.15);
    return buildResult({
      field: field, model: "compound", modelLabel: "compounding " + (p * 100).toFixed(1) + "%/week growth",
      perDayNow: start * Math.log(1 + p) / 7, start: start, fromDate: fromDate,
      target: target, targetDate: targetDate,
      expected: expected, low: Math.max(0, expected - 1.96 * sd), high: expected + 1.96 * sd, sd: sd,
      probability: target === null ? null : probabilityAtLeast(expected, sd, target),
      etaDate: etaDate, alreadyHit: alreadyHit,
      projection: buildProjection(fromDate, endX, value, sdOf)
    });
  }

  /* ---------- SCENARIOS: worst / likely / best per-day rates ----------
     The band IS your worst..best range; the probability comes from treating
     that range as a ~90% spread around the "likely" line. */
  function forecastScenarios(start, worst, likely, best, fromDate, targetDate, target, field) {
    start = Number(start) || 0;
    worst = Number(worst) || 0; likely = Number(likely) || 0; best = Number(best) || 0;
    target = cleanTarget(target);
    var days = daysBetween(fromDate, targetDate);
    if (days < 0) return { ok: false, reason: "Pick a target date in the future." };
    var expected = start + likely * days;
    var lowT = start + worst * days, highT = start + best * days;
    var sd = Math.max(1e-9, (highT - lowT) / (2 * 1.645));
    var etaX = (target !== null && likely > 0) ? (target - start) / likely : null;
    var alreadyHit = target !== null && start >= target;
    var etaDate = alreadyHit ? fromDate : ((etaX !== null && isFinite(etaX) && etaX >= 0) ? addDays(fromDate, etaX) : null);
    var endX = Math.round(Math.max(days, etaX || 0, 1) * 1.15);
    // Band lines ARE the worst/best scenarios (not a statistical band).
    var proj = { dates: [], expected: [], low: [], high: [] };
    var step = Math.max(1, Math.round(endX / 60));
    for (var x = 0; x <= endX; x += step) {
      proj.dates.push(addDays(fromDate, x));
      proj.expected.push(start + likely * x);
      proj.low.push(x === 0 ? null : Math.max(0, start + worst * x));
      proj.high.push(x === 0 ? null : start + best * x);
    }
    return buildResult({
      field: field, model: "scenarios", modelLabel: "best / likely / worst range",
      perDayNow: likely, start: start, fromDate: fromDate, target: target, targetDate: targetDate,
      expected: expected, low: Math.max(0, lowT), high: highT, sd: sd,
      probability: target === null ? null : probabilityAtLeast(expected, sd, target),
      etaDate: etaDate, alreadyHit: alreadyHit,
      projection: proj
    });
  }

  /* ---------- FROM POSTING FREQUENCY ----------
     Converts "X uploads/week × Y gained per upload" into a per-day rate. */
  function forecastFromPosting(start, uploadsPerWeek, perUpload, fromDate, targetDate, target, field) {
    var perDay = (Number(uploadsPerWeek) || 0) * (Number(perUpload) || 0) / 7;
    var r = forecastFromAverage(start, perDay, fromDate, targetDate, target, field);
    if (r.ok) {
      r.model = "posting";
      r.modelLabel = (Number(uploadsPerWeek) || 0) + " uploads/week × " + (Number(perUpload) || 0) + " per upload";
    }
    return r;
  }

  /* ---------- SMART SUGGESTIONS from recent logs ----------
     Powers the "does it for you" prefill: recent per-day rate + weekly %. */
  function suggestFromLogs(snapshots, field) {
    if (!snapshots || snapshots.length < 2) return null;
    var n = Math.min(6, snapshots.length);
    var sub = snapshots.slice(snapshots.length - n);
    var pts = toPoints(sub, field);
    var lin = linearFit(pts);
    var first = sub[0], last = sub[sub.length - 1];
    var span = Math.max(1, daysBetween(first.date, last.date));
    var f0 = Number(first[field]) || 0, f1 = Number(last[field]) || 0;
    var weeklyPct = (f0 > 0) ? (Math.pow(f1 / f0, 7 / span) - 1) : 0;
    var perDay = lin.params.b;
    return {
      perDay: perDay,
      weeklyPct: weeklyPct,
      current: f1,
      worst: Math.max(0, perDay * 0.5),
      likely: Math.max(0, perDay),
      best: Math.max(0, perDay * 1.8)
    };
  }

  window.YT = window.YT || {};
  window.YT.stats = {
    daysBetween: daysBetween,
    addDays: addDays,
    toPoints: toPoints,
    linearFit: linearFit,
    momentumFit: momentumFit,
    plausibleCap: plausibleCap,
    bestFit: bestFit,
    normalCDF: normalCDF,
    probabilityAtLeast: probabilityAtLeast,
    forecast: forecast,
    forecastFromAverage: forecastFromAverage,
    forecastCompound: forecastCompound,
    forecastScenarios: forecastScenarios,
    forecastFromPosting: forecastFromPosting,
    suggestFromLogs: suggestFromLogs
  };
})();
