/* ============================================================
   charts.js — Chart.js wrappers (trend, projection band, revenue, video)
   Theme-aware: reads CSS variables so colors match light/dark.
   ============================================================ */
(function () {
  "use strict";

  var instances = {}; // canvasId -> Chart instance (so we can destroy/redraw)

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function rgba(hex, a) {
    hex = (hex || "#4f8cff").replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  function destroy(id) { if (instances[id]) { instances[id].destroy(); delete instances[id]; } }

  function baseOptions() {
    var text = cssVar("--text-dim") || "#9aa3c0";
    var grid = rgba(cssVar("--border") || "#2a3150", 0.5);
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: text, boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var v = ctx.parsed.y;
              if (v === null || v === undefined) return null;
              return ctx.dataset.label + ": " + Math.round(v).toLocaleString("en-US");
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: text, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: grid } },
        y: { ticks: { color: text, callback: function (v) { return shortNum(v); } }, grid: { color: grid }, beginAtZero: false }
      }
    };
  }

  function shortNum(v) {
    v = Number(v);
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
    return v.toLocaleString("en-US");
  }

  /* ---- simple trend line ---- */
  function trend(id, dates, values, label, colorVar) {
    destroy(id);
    var ctx = document.getElementById(id);
    if (!ctx) return;
    var color = cssVar(colorVar || "--accent") || "#4f8cff";
    instances[id] = new Chart(ctx, {
      type: "line",
      data: {
        labels: dates,
        datasets: [{
          label: label, data: values, borderColor: color,
          backgroundColor: rgba(color, 0.12), fill: true, tension: 0.25,
          pointRadius: 2, pointHoverRadius: 5, borderWidth: 2
        }]
      },
      options: baseOptions()
    });
  }

  /* ---- projection with confidence band ---- */
  function projection(id, result) {
    destroy(id);
    var ctx = document.getElementById(id);
    if (!ctx || !result.ok) return;
    var accent = cssVar("--accent") || "#4f8cff";
    var brand = cssVar("--brand") || "#ff3b3b";
    var warn = cssVar("--warn") || "#ffb020";

    var labels = result.projection.dates;
    // Map historical actuals onto the projection timeline.
    var actualByDate = {};
    result.historical.forEach(function (p) { actualByDate[p.date] = p.y; });
    var actualSeries = labels.map(function (d) { return actualByDate.hasOwnProperty(d) ? actualByDate[d] : null; });

    var opts = baseOptions();
    // Draw a target line via annotation-free approach: add a flat dataset.
    var targetSeries = labels.map(function () { return result.target; });

    instances[id] = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { label: "Actual", data: actualSeries, borderColor: accent, backgroundColor: accent,
            pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, spanGaps: false, tension: 0.2 },
          { label: "Forecast", data: result.projection.expected, borderColor: brand,
            borderDash: [6, 4], pointRadius: 0, borderWidth: 2, tension: 0.2, fill: false },
          { label: "High", data: result.projection.high, borderColor: "transparent",
            backgroundColor: rgba(brand, 0.12), pointRadius: 0, fill: "+1", tension: 0.2 },
          { label: "Low", data: result.projection.low, borderColor: "transparent",
            pointRadius: 0, fill: false, tension: 0.2 },
          { label: "Target", data: targetSeries, borderColor: rgba(warn, 0.9),
            borderDash: [2, 4], pointRadius: 0, borderWidth: 1.5, fill: false }
        ]
      },
      options: opts
    });
  }

  /* ---- revenue split: Shorts vs Long-form ---- */
  function revenue(id, longRev, shortsRev) {
    destroy(id);
    var ctx = document.getElementById(id);
    if (!ctx) return;
    var longC = cssVar("--long") || "#4f8cff";
    var shortC = cssVar("--shorts") || "#b06cff";
    var opts = baseOptions();
    opts.plugins.legend.display = false;
    opts.scales.y.beginAtZero = true;
    opts.plugins.tooltip.callbacks.label = function (ctx) {
      return "$" + (Number(ctx.parsed.y) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
    };
    instances[id] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Long-form", "Shorts"],
        datasets: [{
          label: "Estimated revenue ($)",
          data: [Number(longRev) || 0, Number(shortsRev) || 0],
          backgroundColor: [rgba(longC, 0.85), rgba(shortC, 0.85)],
          borderRadius: 8
        }]
      },
      options: opts
    });
  }

  /* ---- single video growth ---- */
  function video(id, points, label, isShort) {
    destroy(id);
    var ctx = document.getElementById(id);
    if (!ctx) return;
    var color = cssVar(isShort ? "--shorts" : "--long") || "#4f8cff";
    var opts = baseOptions();
    opts.scales.y.beginAtZero = true;
    instances[id] = new Chart(ctx, {
      type: "line",
      data: {
        labels: points.map(function (p) { return p.date; }),
        datasets: [{
          label: label + " — views", data: points.map(function (p) { return p.y; }),
          borderColor: color, backgroundColor: rgba(color, 0.14), fill: true,
          tension: 0.25, pointRadius: 3, borderWidth: 2
        }]
      },
      options: opts
    });
  }

  /* ---- multiple lines on one chart (what-if compare) ---- */
  var PALETTE = ["--brand", "--accent", "--accent-2", "--shorts", "--warn"];
  function multiLine(id, dates, series) {
    destroy(id);
    var ctx = document.getElementById(id);
    if (!ctx) return;
    var datasets = series.map(function (s, i) {
      var color = cssVar(s.colorVar || PALETTE[i % PALETTE.length]) || "#4f8cff";
      return {
        label: s.label, data: s.data, borderColor: color,
        backgroundColor: rgba(color, 0.08), fill: false, tension: 0.2,
        pointRadius: 0, borderWidth: 2
      };
    });
    var opts = baseOptions();
    opts.scales.y.beginAtZero = false;
    instances[id] = new Chart(ctx, { type: "line", data: { labels: dates, datasets: datasets }, options: opts });
  }

  function destroyAll() { Object.keys(instances).forEach(destroy); }

  window.YT = window.YT || {};
  window.YT.charts = {
    trend: trend,
    projection: projection,
    revenue: revenue,
    video: video,
    multiLine: multiLine,
    destroyAll: destroyAll
  };
})();
