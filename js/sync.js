/* ============================================================
   sync.js — optional account + cross-device sync (Supabase)

   The app works with no account at all; this is bolted on the side.
   localStorage stays the source of truth so everything still works
   offline, and we push/pull a single JSON document per user.

   Talks to Supabase's REST endpoints with plain fetch — no SDK, no extra
   CDN script, nothing to load before the app can start.
   ============================================================ */
(function () {
  "use strict";

  var SESSION_KEY = "ytPredictor.session";
  var CONFIG_KEY = "ytPredictor.syncConfig";
  var TABLE = "channel_data";
  var PUSH_DELAY = 2000;       // wait for typing to settle before pushing
  var TOMB_MAX_DAYS = 180;     // forget old deletions eventually

  var S = window.YT.storage;

  /* ---------------- merge (pure, and the heart of this file) ---------------
     Both sides are whole documents with a lastEdit stamp. Rows are keyed
     (dates, ids), so instead of one document clobbering the other we merge
     row by row and only fall back to the stamp when the SAME row differs. */

  function keyOfSnap(s) { return "snap:" + s.date; }
  function keyOfVideo(v) { return "video:" + v.id; }
  function keyOfVSnap(s) { return "vsnap:" + s.videoId + "|" + s.date; }

  function indexBy(arr, keyOf) {
    var map = {};
    (arr || []).forEach(function (item) { map[keyOf(item)] = item; });
    return map;
  }

  // Returns { items, from } where from[key] is the lastEdit of the winning side.
  function mergeList(localArr, remoteArr, keyOf, lStamp, rStamp) {
    var l = indexBy(localArr, keyOf), r = indexBy(remoteArr, keyOf);
    var keys = Object.keys(l);
    Object.keys(r).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); });
    var items = [], from = {};
    keys.forEach(function (k) {
      var a = l[k], b = r[k];
      if (a && b) {
        // Same row on both sides: identical is easy, otherwise newest wins.
        var same = JSON.stringify(a) === JSON.stringify(b);
        var takeLocal = same || lStamp >= rStamp;
        items.push(takeLocal ? a : b);
        from[k] = takeLocal ? lStamp : rStamp;
      } else if (a) {
        items.push(a); from[k] = lStamp;
      } else {
        items.push(b); from[k] = rStamp;
      }
    });
    return { items: items, from: from };
  }

  function mergeTombstones(a, b) {
    var map = {};
    (a || []).concat(b || []).forEach(function (t) {
      if (!map[t.k] || t.at > map[t.k]) map[t.k] = t.at;
    });
    var cutoff = new Date(Date.now() - TOMB_MAX_DAYS * 86400000).toISOString();
    return Object.keys(map)
      .filter(function (k) { return map[k] >= cutoff; })
      .map(function (k) { return { k: k, at: map[k] }; });
  }

  function mergeStates(local, remote) {
    local = local || {}; remote = remote || {};
    var lStamp = local.lastEdit || "", rStamp = remote.lastEdit || "";
    var newer = lStamp >= rStamp ? local : remote;

    var snaps = mergeList(local.channelSnapshots, remote.channelSnapshots, keyOfSnap, lStamp, rStamp);
    var videos = mergeList(local.videos, remote.videos, keyOfVideo, lStamp, rStamp);
    var vsnaps = mergeList(local.videoSnapshots, remote.videoSnapshots, keyOfVSnap, lStamp, rStamp);

    var tombs = mergeTombstones(local.tombstones, remote.tombstones);
    var tombAt = {};
    tombs.forEach(function (t) { tombAt[t.k] = t.at; });

    // A deletion wins unless the surviving copy was edited after the delete.
    function alive(item, keyOf, from) {
      var k = keyOf(item);
      var t = tombAt[k];
      return !t || (from[k] || "") > t;
    }
    var keptSnaps = snaps.items.filter(function (s) { return alive(s, keyOfSnap, snaps.from); });
    var keptVideos = videos.items.filter(function (v) { return alive(v, keyOfVideo, videos.from); });
    var liveIds = {};
    keptVideos.forEach(function (v) { liveIds[v.id] = true; });
    var keptVSnaps = vsnaps.items.filter(function (s) {
      // Readings of a deleted video go with it rather than dangling.
      return liveIds[s.videoId] && alive(s, keyOfVSnap, vsnaps.from);
    });

    return {
      channelSnapshots: keptSnaps,
      videos: keptVideos,
      videoSnapshots: keptVSnaps,
      tombstones: tombs,
      // Settings are small and rarely fought over: take the newer document's.
      settings: newer.settings || local.settings || remote.settings,
      lastEdit: lStamp > rStamp ? lStamp : rStamp
    };
  }

  /* ---------------- config ---------------- */
  function config() {
    var fromFile = window.YT_CONFIG || {};
    if (fromFile.supabaseUrl && fromFile.supabaseAnonKey) {
      return { url: String(fromFile.supabaseUrl).replace(/\/+$/, ""), key: fromFile.supabaseAnonKey, source: "file" };
    }
    try {
      var raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        var c = JSON.parse(raw);
        if (c && c.url && c.key) return { url: String(c.url).replace(/\/+$/, ""), key: c.key, source: "local" };
      }
    } catch (e) { /* ignore */ }
    return null;
  }
  function saveConfig(url, key) {
    url = String(url || "").trim().replace(/\/+$/, "");
    key = String(key || "").trim();
    if (!/^https:\/\/[^\s]+$/.test(url)) return { ok: false, error: "That doesn't look like a project URL — it should start with https://" };
    if (key.length < 20) return { ok: false, error: "That anon key looks too short — copy the whole thing." };
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: url, key: key })); }
    catch (e) { return { ok: false, error: "Couldn't save the settings in this browser." }; }
    return { ok: true };
  }
  function configured() { return !!config(); }

  /* ---------------- session ---------------- */
  var session = null;
  function loadSession() {
    if (session) return session;
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (raw) session = JSON.parse(raw);
    } catch (e) { session = null; }
    return session;
  }
  function storeSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }
  function user() {
    var s = loadSession();
    return s && s.email ? { email: s.email, id: s.userId } : null;
  }

  /* ---------------- status ---------------- */
  var status = { state: "off", message: "", lastSyncedAt: null };
  var statusListeners = [];
  function onStatus(fn) { if (typeof fn === "function") statusListeners.push(fn); }
  function setStatus(state, message) {
    status.state = state;
    status.message = message || "";
    status.email = user() ? user().email : null;
    statusListeners.forEach(function (fn) {
      try { fn(status); } catch (e) { /* ignore */ }
    });
  }
  function currentStatus() { return status; }

  /* ---------------- HTTP ---------------- */
  function request(path, opts) {
    var c = config();
    if (!c) return Promise.reject(new Error("Sync isn't set up yet."));
    opts = opts || {};
    var headers = { "apikey": c.key, "Content-Type": "application/json" };
    if (opts.headers) Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });
    if (opts.auth !== false) {
      var s = loadSession();
      headers["Authorization"] = "Bearer " + ((s && s.accessToken) || c.key);
    }
    return fetch(c.url + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
        if (!res.ok) {
          var msg = (data && (data.msg || data.message || data.error_description || data.error)) ||
            ("Request failed (" + res.status + ")");
          var err = new Error(msg);
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function sessionFrom(data) {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      email: (data.user && data.user.email) || (data.email) || "",
      userId: (data.user && data.user.id) || data.id || ""
    };
  }

  // Refresh a token that's expired (or about to), so a long-lived tab keeps working.
  function ensureFreshToken() {
    var s = loadSession();
    if (!s) return Promise.reject(new Error("You're signed out."));
    if (s.expiresAt && s.expiresAt - Date.now() > 60000) return Promise.resolve(s);
    if (!s.refreshToken) return Promise.reject(new Error("Your session expired — sign in again."));
    return request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", auth: false, body: { refresh_token: s.refreshToken }
    }).then(function (data) {
      var next = sessionFrom(data);
      if (!next.email) next.email = s.email;
      if (!next.userId) next.userId = s.userId;
      storeSession(next);
      return next;
    });
  }

  /* ---------------- auth ---------------- */
  function signUp(email, password) {
    setStatus("working", "Creating your account…");
    return request("/auth/v1/signup", { method: "POST", auth: false, body: { email: email, password: password } })
      .then(function (data) {
        if (data && data.access_token) {
          storeSession(sessionFrom(data));
          return syncNow().then(function () { return { ok: true, signedIn: true }; });
        }
        // Email confirmation is on for this project.
        setStatus("signed-out", "Account created — check your email to confirm, then sign in.");
        return { ok: true, signedIn: false, needsConfirm: true };
      })
      .catch(function (err) {
        setStatus("error", err.message);
        return { ok: false, error: err.message };
      });
  }

  function signIn(email, password) {
    setStatus("working", "Signing in…");
    return request("/auth/v1/token?grant_type=password", {
      method: "POST", auth: false, body: { email: email, password: password }
    }).then(function (data) {
      storeSession(sessionFrom(data));
      return syncNow().then(function () { return { ok: true }; });
    }).catch(function (err) {
      setStatus("error", err.message);
      return { ok: false, error: err.message };
    });
  }

  function signOut() {
    // Local data is deliberately left alone — signing out isn't losing your logs.
    storeSession(null);
    setStatus("signed-out", "Signed out. Your data is still on this device.");
    return Promise.resolve({ ok: true });
  }

  /* ---------------- pull / push ---------------- */
  function pull() {
    return ensureFreshToken().then(function (s) {
      return request("/rest/v1/" + TABLE + "?select=data,updated_at&user_id=eq." + encodeURIComponent(s.userId));
    }).then(function (rows) {
      if (!rows || !rows.length) return null;
      return rows[0].data || null;
    });
  }

  function push(doc) {
    return ensureFreshToken().then(function (s) {
      return request("/rest/v1/" + TABLE, {
        method: "POST",
        headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
        body: { user_id: s.userId, data: doc, updated_at: new Date().toISOString() }
      });
    });
  }

  // The whole round trip: take what's on the server, merge, keep both, put it back.
  function syncNow() {
    if (!user()) { setStatus("signed-out", ""); return Promise.resolve({ ok: false, error: "Signed out." }); }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setStatus("offline", "No connection — your changes are saved here and will sync later.");
      return Promise.resolve({ ok: false, offline: true });
    }
    setStatus("syncing", "Syncing…");
    var local = S.getState();
    // A browser that has only ever shown the bundled demo data holds nothing
    // worth keeping. Merging it would smear sample rows across every device,
    // so it gets replaced by the account's data and is never uploaded.
    var localIsDemo = S.isSampleData();
    return pull().then(function (remote) {
      if (localIsDemo) {
        if (!remote) {
          // Nothing either side: leave the account empty until real data exists.
          status.lastSyncedAt = new Date().toISOString();
          setStatus("idle", "Signed in. Add your first real numbers and they'll sync.");
          return { ok: true, pulled: false, skipped: "demo-data" };
        }
        // silent: this came from the server, so don't stamp it as a local edit
        // and don't trigger another push.
        S.replaceState(remote, { silent: true });
        status.lastSyncedAt = new Date().toISOString();
        setStatus("idle", "");
        notifyPulled();
        return { ok: true, pulled: true, replacedDemo: true };
      }
      var merged = remote ? mergeStates(local, remote) : local;
      if (remote) S.replaceState(merged, { silent: true });
      return push(merged).then(function () {
        status.lastSyncedAt = new Date().toISOString();
        setStatus("idle", "");
        if (remote) notifyPulled();
        return { ok: true, pulled: !!remote };
      });
    }).catch(function (err) {
      setStatus("error", err.message);
      return { ok: false, error: err.message };
    });
  }

  // Lets the app re-render after a pull replaced the data underneath it.
  var pulledListeners = [];
  function onPulled(fn) { if (typeof fn === "function") pulledListeners.push(fn); }
  function notifyPulled() {
    pulledListeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }

  /* ---------------- wiring ---------------- */
  var pushTimer = null;
  function init() {
    if (!configured()) { setStatus("off", ""); return; }
    // Any local edit schedules a push, coalesced so typing isn't chatty.
    S.onChange(function () {
      if (!user() || S.isSampleData()) return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(function () {
        if (!user() || S.isSampleData()) return;
        setStatus("syncing", "Saving to your account…");
        push(S.getState()).then(function () {
          status.lastSyncedAt = new Date().toISOString();
          setStatus("idle", "");
        }).catch(function (err) { setStatus("error", err.message); });
      }, PUSH_DELAY);
    });
    if (typeof window.addEventListener === "function") {
      window.addEventListener("online", function () { if (user()) syncNow(); });
    }
    if (user()) syncNow(); else setStatus("signed-out", "");
  }

  window.YT = window.YT || {};
  window.YT.sync = {
    init: init,
    configured: configured,
    config: config,
    saveConfig: saveConfig,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    user: user,
    syncNow: syncNow,
    status: currentStatus,
    onStatus: onStatus,
    onPulled: onPulled,
    // exported for tests
    mergeStates: mergeStates
  };
})();
