/* ============================================================
   storage.js — data model + persistence + import/export
   Everything lives in localStorage under one key.
   ============================================================ */
(function () {
  "use strict";

  var KEY = "ytPredictor.v1";

  function emptyState() {
    return {
      channelSnapshots: [],
      videos: [],
      videoSnapshots: [],
      // Deletions have to travel between devices too, or anything you delete
      // on one comes back from the other. Each entry: { k: "<kind>:<id>", at }.
      tombstones: [],
      // When this device last changed anything — used to settle merge conflicts.
      lastEdit: "",
      // True while the browser is still showing the bundled demo data and the
      // user hasn't typed anything of their own. Demo rows must never be
      // uploaded to an account or merged into real data.
      isSample: false,
      settings: {
        goalSubs: 1000,
        goalDate: "",
        targetLongRPM: 4.0,
        targetShortsRPM: 0.08,
        theme: "dark",
        goals: []
      }
    };
  }

  // Deep-ish clone so callers never mutate the sample/global by reference.
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  var state = null;

  function load() {
    if (state) return state;
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (raw) {
      try {
        state = normalize(JSON.parse(raw));
        return state;
      } catch (e) { /* corrupt — fall through to sample */ }
    }
    // First run (or unreadable): seed from bundled sample if present. Saved
    // silently so it doesn't look like an edit this device made.
    state = window.YT_SAMPLE ? normalize(clone(window.YT_SAMPLE)) : emptyState();
    state.isSample = !!window.YT_SAMPLE;
    save({ silent: true });
    return state;
  }

  // Guarantee all expected arrays/fields exist even if a backup is older.
  function normalize(s) {
    var base = emptyState();
    s = s || {};
    base.channelSnapshots = Array.isArray(s.channelSnapshots) ? s.channelSnapshots : [];
    base.videos = (Array.isArray(s.videos) ? s.videos : []).map(cleanVideo);
    // Readings saved before the Shorts stats existed get the new fields at 0.
    base.videoSnapshots = (Array.isArray(s.videoSnapshots) ? s.videoSnapshots : [])
      .map(cleanVideoSnapshot);
    base.tombstones = (Array.isArray(s.tombstones) ? s.tombstones : [])
      .filter(function (t) { return t && t.k && t.at; })
      .map(function (t) { return { k: String(t.k), at: String(t.at) }; });
    base.lastEdit = s.lastEdit || "";
    base.isSample = s.isSample === true;
    if (s.settings) {
      base.settings.goalSubs = num(s.settings.goalSubs, base.settings.goalSubs);
      base.settings.goalDate = s.settings.goalDate || "";
      base.settings.targetLongRPM = num(s.settings.targetLongRPM, base.settings.targetLongRPM);
      base.settings.targetShortsRPM = num(s.settings.targetShortsRPM, base.settings.targetShortsRPM);
      base.settings.theme = s.settings.theme === "light" ? "light" : "dark";
      base.settings.goals = sanitizeGoals(s.settings.goals);
      // Migrate the old single subscriber goal into the goals list.
      if (!base.settings.goals.length && s.settings.goalSubs) {
        base.settings.goals = [{ id: "g_subs", metric: "totalSubs", target: num(s.settings.goalSubs, 1000), date: s.settings.goalDate || "" }];
      }
    }
    base.channelSnapshots.sort(byDate);
    base.videoSnapshots.sort(byDate);
    return base;
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : fallback;
  }
  // Percentages typed by hand (retention, "stayed to watch") — keep them sane.
  function clampPct(v) {
    var n = parseFloat(v);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.min(100, n);
  }

  // A tracked video. durationSec is the video's own length — used to work out
  // what share of it people actually watch.
  function cleanVideo(v) {
    v = v || {};
    return {
      id: v.id,
      title: v.title || "(untitled)",
      type: v.type === "short" ? "short" : "long",
      publishDate: v.publishDate || "",
      publishTime: v.publishTime || "",
      description: v.description || "",
      durationSec: Math.max(0, Math.round(num(v.durationSec, 0)))
    };
  }

  // One reading for one video. Long-form and Shorts don't share a stat sheet:
  // watch hours only mean something for long-form, engaged views + "stayed to
  // watch" only for Shorts. Average view duration is the one retention number
  // both have, stored as whole seconds.
  function cleanVideoSnapshot(snap) {
    snap = snap || {};
    return {
      videoId: snap.videoId,
      date: snap.date,
      views: num(snap.views, 0),
      likes: num(snap.likes, 0),
      comments: num(snap.comments, 0),
      // Subscribers this one video brought in — tracked for both types.
      subsGained: num(snap.subsGained, 0),
      avgViewDurationSec: Math.max(0, Math.round(num(snap.avgViewDurationSec, 0))),
      watchHours: num(snap.watchHours, 0),
      engagedViews: num(snap.engagedViews, 0),
      stayedToWatch: clampPct(snap.stayedToWatch)
    };
  }

  var GOAL_METRICS = ["totalSubs", "longformViews", "watchHoursTotal", "shortsViews90d", "revenue"];
  function sanitizeGoals(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(function (g) {
      return g && GOAL_METRICS.indexOf(g.metric) !== -1 && num(g.target, 0) > 0;
    }).map(function (g) {
      return { id: g.id || ("g" + Math.floor(num(g.target, 0)) + g.metric), metric: g.metric, target: num(g.target, 0), date: g.date || "" };
    });
  }
  function byDate(a, b) { return (a.date < b.date) ? -1 : (a.date > b.date ? 1 : 0); }

  /* ---- Persistence + change notifications --------------------------------
     Every write in this file ends at save(), which makes it the one place a
     sync layer has to listen to. save({ silent: true }) writes without
     stamping or notifying — used when applying data that came FROM the
     server, so it doesn't bounce straight back. */
  var listeners = [];
  function onChange(fn) { if (typeof fn === "function") listeners.push(fn); }

  function save(opts) {
    opts = opts || {};
    if (!opts.silent) {
      state.lastEdit = nowISO();
      // Touching the actual data means this is now the user's own — but
      // flipping the theme shouldn't promote a screen of demo rows.
      if (!opts.keepSample) state.isSample = false;
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn("Could not save to localStorage:", e); }
    if (!opts.silent) {
      listeners.forEach(function (fn) {
        try { fn(state); } catch (e) { console.warn("change listener failed:", e); }
      });
    }
  }

  function nowISO() { return new Date().toISOString(); }

  // Remember that something was deleted, so the deletion can travel to other
  // devices instead of being undone by them.
  function tombstone(kind, id) {
    var k = kind + ":" + id;
    state.tombstones = state.tombstones.filter(function (t) { return t.k !== k; });
    state.tombstones.push({ k: k, at: nowISO() });
  }
  // Re-creating something clears its tombstone, or the next merge would
  // delete it all over again.
  function untomb(kind, id) {
    var k = kind + ":" + id;
    state.tombstones = state.tombstones.filter(function (t) { return t.k !== k; });
  }

  /* ---- Handing the app over from demo to real data ----------------------
     A first-time visitor sees the bundled sample so the app isn't an empty
     shell. The moment they enter something of their own, the demo has to go:
     otherwise their charts mix 866 invented subscribers with their real 7,
     and (with sync on) the invented ones get uploaded to their account. */
  var demoCleared = false;
  function beginRealEdit() {
    if (!state.isSample) return;
    state.channelSnapshots = [];
    state.videos = [];
    state.videoSnapshots = [];
    state.tombstones = [];
    state.isSample = false;
    demoCleared = true;
  }
  // Read-and-reset, so the UI can mention it exactly once.
  function consumeDemoCleared() {
    var was = demoCleared;
    demoCleared = false;
    return was;
  }

  function getState() { return load(); }

  function replaceState(newState, opts) {
    state = normalize(newState);
    save(opts);
    return state;
  }

  function reset() {
    state = window.YT_SAMPLE ? normalize(clone(window.YT_SAMPLE)) : emptyState();
    state.isSample = !!window.YT_SAMPLE;
    save({ silent: true });
    return state;
  }

  function clear() {
    state = emptyState();
    save();
    return state;
  }

  /* -------- Channel snapshots -------- */
  // One snapshot per date; adding an existing date overwrites it.
  function upsertSnapshot(snap) {
    load();
    beginRealEdit();
    var idx = -1;
    for (var i = 0; i < state.channelSnapshots.length; i++) {
      if (state.channelSnapshots[i].date === snap.date) { idx = i; break; }
    }
    var clean = {
      date: snap.date,
      totalSubs: num(snap.totalSubs, 0),
      longformViews: num(snap.longformViews, 0),
      watchHoursTotal: num(snap.watchHoursTotal, 0),
      shortsViews90d: num(snap.shortsViews90d, 0),
      longRPM: num(snap.longRPM, state.settings.targetLongRPM),
      shortsRPM: num(snap.shortsRPM, state.settings.targetShortsRPM)
    };
    if (idx >= 0) state.channelSnapshots[idx] = clean;
    else state.channelSnapshots.push(clean);
    state.channelSnapshots.sort(byDate);
    untomb("snap", clean.date);
    save();
  }

  function deleteSnapshot(date) {
    load();
    state.channelSnapshots = state.channelSnapshots.filter(function (s) { return s.date !== date; });
    tombstone("snap", date);
    save({ keepSample: true });
  }

  function latestSnapshot() {
    load();
    return state.channelSnapshots.length ? state.channelSnapshots[state.channelSnapshots.length - 1] : null;
  }

  /* -------- Videos -------- */
  function addVideo(v) {
    load();
    beginRealEdit();
    var id = "v" + Date.now() + Math.floor(Math.random() * 1000);
    var clean = cleanVideo(v);
    clean.id = id;
    state.videos.push(clean);
    untomb("video", id);
    save();
    return id;
  }
  // Patch fields on an existing video (used to fill in a length later on).
  function updateVideo(id, patch) {
    load();
    for (var i = 0; i < state.videos.length; i++) {
      if (state.videos[i].id !== id) continue;
      var merged = {};
      Object.keys(state.videos[i]).forEach(function (k) { merged[k] = state.videos[i][k]; });
      Object.keys(patch || {}).forEach(function (k) { merged[k] = patch[k]; });
      merged.id = id;
      state.videos[i] = cleanVideo(merged);
      save({ keepSample: true });
      return state.videos[i];
    }
    return null;
  }
  function deleteVideo(id) {
    load();
    state.videos = state.videos.filter(function (v) { return v.id !== id; });
    state.videoSnapshots = state.videoSnapshots.filter(function (s) { return s.videoId !== id; });
    // One tombstone for the video; its readings are dropped wherever it lands.
    tombstone("video", id);
    save({ keepSample: true });
  }
  // Upsert by (videoId, date): re-adding the same date overwrites, so it
  // doubles as "edit this reading".
  function addVideoSnapshot(snap) {
    load();
    beginRealEdit();
    var clean = cleanVideoSnapshot(snap);
    var idx = -1;
    for (var i = 0; i < state.videoSnapshots.length; i++) {
      if (state.videoSnapshots[i].videoId === clean.videoId && state.videoSnapshots[i].date === clean.date) { idx = i; break; }
    }
    if (idx >= 0) state.videoSnapshots[idx] = clean;
    else state.videoSnapshots.push(clean);
    state.videoSnapshots.sort(byDate);
    untomb("vsnap", clean.videoId + "|" + clean.date);
    save();
  }
  function deleteVideoSnapshot(videoId, date) {
    load();
    state.videoSnapshots = state.videoSnapshots.filter(function (s) {
      return !(s.videoId === videoId && s.date === date);
    });
    tombstone("vsnap", videoId + "|" + date);
    save({ keepSample: true });
  }
  function snapshotsForVideo(id) {
    load();
    return state.videoSnapshots.filter(function (s) { return s.videoId === id; }).sort(byDate);
  }

  /* -------- Settings & goals -------- */
  function updateSettings(patch) {
    load();
    for (var k in patch) if (patch.hasOwnProperty(k)) state.settings[k] = patch[k];
    save({ keepSample: true });
  }

  function addGoal(g) {
    load();
    var id = "g" + Date.now() + Math.floor(Math.random() * 1000);
    state.settings.goals.push({ id: id, metric: g.metric, target: num(g.target, 0), date: g.date || "" });
    save();
    return id;
  }
  function deleteGoal(id) {
    load();
    state.settings.goals = state.settings.goals.filter(function (g) { return g.id !== id; });
    save();
  }

  /* -------- Export / import -------- */
  function exportJSON() {
    return JSON.stringify(getState(), null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text); // throws on bad input — caller catches
    return replaceState(parsed);
  }

  // CSV of channel snapshots (the main spreadsheet-friendly table).
  function exportCSV() {
    load();
    var cols = ["date", "totalSubs", "longformViews", "watchHoursTotal", "shortsViews90d", "longRPM", "shortsRPM"];
    var lines = [cols.join(",")];
    state.channelSnapshots.forEach(function (s) {
      lines.push(cols.map(function (c) { return csvCell(s[c]); }).join(","));
    });
    return lines.join("\r\n");
  }
  function csvCell(v) {
    if (v === undefined || v === null) return "";
    var str = String(v);
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  }

  function parseCSVLine(line) {
    var out = [], cur = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === ",") { out.push(cur); cur = ""; }
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  // Import channel snapshots from a CSV (upsert by date). Throws on a
  // malformed file (missing date column) so the caller can warn the user.
  function importCSV(text) {
    var lines = String(text).split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
    if (!lines.length) throw new Error("Empty file");
    var header = parseCSVLine(lines[0]).map(function (s) { return s.trim(); });
    var idx = {};
    header.forEach(function (h, i) { idx[h] = i; });
    if (idx.date === undefined) throw new Error("CSV needs a 'date' column");
    load();
    var added = 0;
    for (var i = 1; i < lines.length; i++) {
      var c = parseCSVLine(lines[i]);
      var date = (c[idx.date] || "").trim();
      if (!date) continue;
      upsertSnapshot({
        date: date,
        totalSubs: c[idx.totalSubs], longformViews: c[idx.longformViews],
        watchHoursTotal: c[idx.watchHoursTotal], shortsViews90d: c[idx.shortsViews90d],
        longRPM: c[idx.longRPM], shortsRPM: c[idx.shortsRPM]
      });
      added++;
    }
    return added;
  }

  window.YT = window.YT || {};
  window.YT.storage = {
    getState: getState,
    replaceState: replaceState,
    onChange: onChange,
    isSampleData: function () { return load().isSample === true; },
    consumeDemoCleared: consumeDemoCleared,
    reset: reset,
    clear: clear,
    upsertSnapshot: upsertSnapshot,
    deleteSnapshot: deleteSnapshot,
    latestSnapshot: latestSnapshot,
    addVideo: addVideo,
    updateVideo: updateVideo,
    deleteVideo: deleteVideo,
    addVideoSnapshot: addVideoSnapshot,
    deleteVideoSnapshot: deleteVideoSnapshot,
    snapshotsForVideo: snapshotsForVideo,
    updateSettings: updateSettings,
    addGoal: addGoal,
    deleteGoal: deleteGoal,
    exportJSON: exportJSON,
    importJSON: importJSON,
    exportCSV: exportCSV,
    importCSV: importCSV
  };
})();
