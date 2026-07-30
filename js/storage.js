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
    // First run (or unreadable): seed from bundled sample if present.
    state = window.YT_SAMPLE ? normalize(clone(window.YT_SAMPLE)) : emptyState();
    save();
    return state;
  }

  // Guarantee all expected arrays/fields exist even if a backup is older.
  function normalize(s) {
    var base = emptyState();
    s = s || {};
    base.channelSnapshots = Array.isArray(s.channelSnapshots) ? s.channelSnapshots : [];
    base.videos = Array.isArray(s.videos) ? s.videos : [];
    base.videoSnapshots = Array.isArray(s.videoSnapshots) ? s.videoSnapshots : [];
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

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn("Could not save to localStorage:", e); }
  }

  function getState() { return load(); }

  function replaceState(newState) {
    state = normalize(newState);
    save();
    return state;
  }

  function reset() {
    state = window.YT_SAMPLE ? normalize(clone(window.YT_SAMPLE)) : emptyState();
    save();
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
    save();
  }

  function deleteSnapshot(date) {
    load();
    state.channelSnapshots = state.channelSnapshots.filter(function (s) { return s.date !== date; });
    save();
  }

  function latestSnapshot() {
    load();
    return state.channelSnapshots.length ? state.channelSnapshots[state.channelSnapshots.length - 1] : null;
  }

  /* -------- Videos -------- */
  function addVideo(v) {
    load();
    var id = "v" + Date.now() + Math.floor(Math.random() * 1000);
    state.videos.push({
      id: id,
      title: v.title,
      type: v.type === "short" ? "short" : "long",
      publishDate: v.publishDate,
      publishTime: v.publishTime || "",
      description: v.description || ""
    });
    save();
    return id;
  }
  function deleteVideo(id) {
    load();
    state.videos = state.videos.filter(function (v) { return v.id !== id; });
    state.videoSnapshots = state.videoSnapshots.filter(function (s) { return s.videoId !== id; });
    save();
  }
  // Upsert by (videoId, date): re-adding the same date overwrites, so it
  // doubles as "edit this reading".
  function addVideoSnapshot(snap) {
    load();
    var clean = {
      videoId: snap.videoId,
      date: snap.date,
      views: num(snap.views, 0),
      likes: num(snap.likes, 0),
      comments: num(snap.comments, 0),
      watchHours: num(snap.watchHours, 0)
    };
    var idx = -1;
    for (var i = 0; i < state.videoSnapshots.length; i++) {
      if (state.videoSnapshots[i].videoId === clean.videoId && state.videoSnapshots[i].date === clean.date) { idx = i; break; }
    }
    if (idx >= 0) state.videoSnapshots[idx] = clean;
    else state.videoSnapshots.push(clean);
    state.videoSnapshots.sort(byDate);
    save();
  }
  function deleteVideoSnapshot(videoId, date) {
    load();
    state.videoSnapshots = state.videoSnapshots.filter(function (s) {
      return !(s.videoId === videoId && s.date === date);
    });
    save();
  }
  function snapshotsForVideo(id) {
    load();
    return state.videoSnapshots.filter(function (s) { return s.videoId === id; }).sort(byDate);
  }

  /* -------- Settings & goals -------- */
  function updateSettings(patch) {
    load();
    for (var k in patch) if (patch.hasOwnProperty(k)) state.settings[k] = patch[k];
    save();
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
    reset: reset,
    clear: clear,
    upsertSnapshot: upsertSnapshot,
    deleteSnapshot: deleteSnapshot,
    latestSnapshot: latestSnapshot,
    addVideo: addVideo,
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
