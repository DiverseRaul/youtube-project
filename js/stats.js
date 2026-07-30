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

  /* ---------- EXPONENTIAL: y = a·e^(b·x)  (fit in log space) ---------- */
  function expFit(pts) {
    var usable = pts.filter(function (p) { return p.y > 0; });
    if (usable.length < 2) return null;
    var n = usable.length, sx = 0, sly = 0, sxx = 0, sxly = 0;
    usable.forEach(function (p) {
      var ly = Math.log(p.y);
      sx += p.x; sly += ly; sxx += p.x * p.x; sxly += p.x * ly;
    });
    var denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    var b = (n * sxly - sx * sly) / denom;
    var lnA = (sly - b * sx) / n;
    var a = Math.exp(lnA);
    var predict = function (x) { return a * Math.exp(b * x); };
    return {
      type: "exponential", label: "accelerating (compounding) growth",
      predict: predict, params: { a: a, b: b },
      r2: rSquared(pts, predict), residualStd: residualStd(pts, predict),
      slopeAt: function (x) { return b * predict(x); },
      solveX: function (target) { return (target <= 0 || a <= 0 || b === 0) ? null : Math.log(target / a) / b; }
    };
  }

  /* ---------- LOGISTIC: y = L / (1 + e^(-k(x - x0))) ---------- */
  // No nonlinear solver available, so grid-search the ceiling L and
  // linearize the rest: ln(y/(L-y)) = k·x - k·x0.
  // NOTE: all closures (predict/slopeAt/solveX) are built together in
  // makeLogistic so they bind to the SAME L/k/x0 — building them inline
  // in the loop would capture the loop's final iteration instead.
  function makeLogistic(L, k, x0, pts) {
    var predict = function (x) { return L / (1 + Math.exp(-k * (x - x0))); };
    return {
      type: "logistic", label: "growth that speeds up then levels off (S-curve)",
      predict: predict, params: { L: L, k: k, x0: x0 },
      r2: rSquared(pts, predict), residualStd: residualStd(pts, predict),
      slopeAt: function (x) { var y = predict(x); return k * y * (1 - y / L); },
      solveX: function (target) {
        if (target <= 0 || target >= L) return null;
        return x0 - Math.log(L / target - 1) / k;
      }
    };
  }
  function logisticFit(pts) {
    var maxY = Math.max.apply(null, pts.map(function (p) { return p.y; }));
    if (maxY <= 0) return null;
    var best = null;
    for (var f = 1.05; f <= 4.0; f += 0.05) {
      var L = maxY * f;
      var usable = pts.filter(function (p) { return p.y > 0 && p.y < L; });
      if (usable.length < 3) continue;
      var n = usable.length, sx = 0, sz = 0, sxx = 0, sxz = 0, bad = false;
      usable.forEach(function (p) {
        var ratio = p.y / (L - p.y);
        if (!(ratio > 0)) { bad = true; return; }
        var z = Math.log(ratio);
        sx += p.x; sz += z; sxx += p.x * p.x; sxz += p.x * z;
      });
      if (bad) continue;
      var denom = n * sxx - sx * sx;
      if (denom === 0) continue;
      var k = (n * sxz - sx * sz) / denom;
      var intercept = (sz - k * sx) / n; // = -k·x0
      if (!(k > 0)) continue;            // require growth, not decay
      var candidate = makeLogistic(L, k, -intercept / k, pts);
      if (!best || candidate.r2 > best.r2) best = candidate;
    }
    return best;
  }

  /* ---------- pick the best model by R² ---------- */
  function bestFit(pts) {
    var candidates = [linearFit(pts), expFit(pts), logisticFit(pts)].filter(Boolean);
    candidates.sort(function (a, b) { return b.r2 - a.r2; });
    return candidates[0];
  }

  /* ---------- high-level forecast used by the UI ---------- */
  // opts: { method: "auto"|"manual", manualRate: number }
  function forecast(snapshots, field, targetDate, target, opts) {
    opts = opts || {};
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

    // Uncertainty grows the further we extrapolate beyond known data.
    var rangeX = Math.max(1, xMax - pts[0].x);
    var extrapolation = Math.max(0, (xTarget - xMax) / rangeX);
    var sd = fit.residualStd * (1 + 0.5 * Math.min(extrapolation, 4));

    var expected = fit.predict(xTarget);
    var low = expected - 1.96 * sd;   // ~95% band
    var high = expected + 1.96 * sd;
    var probability = probabilityAtLeast(expected, sd, target);

    // ETA: when does the model first reach the target?
    var etaX = fit.solveX(target);
    var etaDate = (etaX !== null && isFinite(etaX)) ? addDays(ref, etaX) : null;
    // If already past the target, ETA is effectively now/past.
    if (lastPt.y >= target) etaDate = lastPt.date;

    // Build a smooth projection series from last real date to a bit past target.
    var projStartX = pts[0].x;
    var projEndX = Math.max(xTarget, xMax) + Math.round(rangeX * 0.15);
    var projection = { dates: [], expected: [], low: [], high: [] };
    var step = Math.max(1, Math.round((projEndX - projStartX) / 60));
    for (var x = projStartX; x <= projEndX; x += step) {
      var e = fit.predict(x);
      var localExtra = Math.max(0, (x - xMax) / rangeX);
      var s = fit.residualStd * (1 + 0.5 * Math.min(localExtra, 4));
      projection.dates.push(addDays(ref, x));
      projection.expected.push(e);
      projection.low.push(x <= xMax ? null : e - 1.96 * s);   // only show band for the future
      projection.high.push(x <= xMax ? null : e + 1.96 * s);
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
      targetDate: targetDate,
      expected: expected,
      low: Math.max(0, low),
      high: high,
      sd: sd,
      probability: probability,
      etaDate: etaDate,
      alreadyHit: lastPt.y >= target,
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
    target = Number(target) || 0;
    cv = (cv === undefined ? 0.35 : cv); // assumed ~35% variation around the average
    var days = daysBetween(fromDate, targetDate);
    if (days < 0) return { ok: false, reason: "Pick a target date in the future." };

    var expected = start + ratePerDay * days;
    // With no history we don't know the real volatility, so model the running
    // total's spread as (variation × rate × √days) — uncertainty grows over time.
    var sd = Math.abs(ratePerDay) * cv * Math.sqrt(Math.max(1, days));
    var low = Math.max(0, expected - 1.96 * sd);
    var high = expected + 1.96 * sd;
    var probability = probabilityAtLeast(expected, sd, target);

    var etaX = ratePerDay > 0 ? (target - start) / ratePerDay : null;
    var alreadyHit = start >= target;
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
      target: target, targetDate: targetDate,
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
      target: o.target, targetDate: o.targetDate,
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
    target = Number(target) || 0;
    var days = daysBetween(fromDate, targetDate);
    if (days < 0) return { ok: false, reason: "Pick a target date in the future." };
    var cv = 0.35;
    var value = function (x) { return start * Math.pow(1 + p, x / 7); };
    var sdOf = function (x) { return cv * Math.max(0, value(x) - start); };
    var expected = value(days), sd = sdOf(days);
    var etaX = (p > 0 && start > 0 && target > start) ? 7 * Math.log(target / start) / Math.log(1 + p) : (start >= target ? 0 : null);
    var alreadyHit = start >= target;
    var etaDate = alreadyHit ? fromDate : ((etaX !== null && isFinite(etaX) && etaX >= 0) ? addDays(fromDate, etaX) : null);
    var endX = Math.round(Math.max(days, etaX || 0, 1) * 1.15);
    return buildResult({
      field: field, model: "compound", modelLabel: "compounding " + (p * 100).toFixed(1) + "%/week growth",
      perDayNow: start * Math.log(1 + p) / 7, start: start, fromDate: fromDate,
      target: target, targetDate: targetDate,
      expected: expected, low: Math.max(0, expected - 1.96 * sd), high: expected + 1.96 * sd, sd: sd,
      probability: probabilityAtLeast(expected, sd, target), etaDate: etaDate, alreadyHit: alreadyHit,
      projection: buildProjection(fromDate, endX, value, sdOf)
    });
  }

  /* ---------- SCENARIOS: worst / likely / best per-day rates ----------
     The band IS your worst..best range; the probability comes from treating
     that range as a ~90% spread around the "likely" line. */
  function forecastScenarios(start, worst, likely, best, fromDate, targetDate, target, field) {
    start = Number(start) || 0;
    worst = Number(worst) || 0; likely = Number(likely) || 0; best = Number(best) || 0;
    target = Number(target) || 0;
    var days = daysBetween(fromDate, targetDate);
    if (days < 0) return { ok: false, reason: "Pick a target date in the future." };
    var expected = start + likely * days;
    var lowT = start + worst * days, highT = start + best * days;
    var sd = Math.max(1e-9, (highT - lowT) / (2 * 1.645));
    var etaX = likely > 0 ? (target - start) / likely : null;
    var alreadyHit = start >= target;
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
      probability: probabilityAtLeast(expected, sd, target), etaDate: etaDate, alreadyHit: alreadyHit,
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
    expFit: expFit,
    logisticFit: logisticFit,
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
