/* Sample data — loaded on first run so the app isn't empty.
   Delivered as JS (not JSON) so it also works when you just double-click
   index.html locally (the file:// protocol blocks fetch of .json files). */
window.YT_SAMPLE = {
  channelSnapshots: [
    { date: "2026-04-01", totalSubs: 210, longformViews: 42000,  watchHoursTotal: 900,  shortsViews90d: 80000,   longRPM: 4.00, shortsRPM: 0.08 },
    { date: "2026-04-08", totalSubs: 245, longformViews: 46000,  watchHoursTotal: 980,  shortsViews90d: 110000,  longRPM: 4.00, shortsRPM: 0.08 },
    { date: "2026-04-15", totalSubs: 285, longformViews: 51000,  watchHoursTotal: 1080, shortsViews90d: 150000,  longRPM: 4.00, shortsRPM: 0.08 },
    { date: "2026-04-22", totalSubs: 320, longformViews: 56500,  watchHoursTotal: 1180, shortsViews90d: 200000,  longRPM: 4.00, shortsRPM: 0.08 },
    { date: "2026-04-29", totalSubs: 360, longformViews: 62000,  watchHoursTotal: 1290, shortsViews90d: 260000,  longRPM: 4.00, shortsRPM: 0.08 },
    { date: "2026-05-06", totalSubs: 405, longformViews: 68500,  watchHoursTotal: 1410, shortsViews90d: 330000,  longRPM: 4.10, shortsRPM: 0.08 },
    { date: "2026-05-13", totalSubs: 450, longformViews: 75000,  watchHoursTotal: 1540, shortsViews90d: 410000,  longRPM: 4.10, shortsRPM: 0.08 },
    { date: "2026-05-20", totalSubs: 495, longformViews: 82000,  watchHoursTotal: 1680, shortsViews90d: 500000,  longRPM: 4.10, shortsRPM: 0.09 },
    { date: "2026-05-27", totalSubs: 540, longformViews: 90000,  watchHoursTotal: 1830, shortsViews90d: 600000,  longRPM: 4.10, shortsRPM: 0.09 },
    { date: "2026-06-03", totalSubs: 585, longformViews: 98500,  watchHoursTotal: 1990, shortsViews90d: 710000,  longRPM: 4.20, shortsRPM: 0.09 },
    { date: "2026-06-10", totalSubs: 632, longformViews: 108000, watchHoursTotal: 2160, shortsViews90d: 830000,  longRPM: 4.20, shortsRPM: 0.09 },
    { date: "2026-06-17", totalSubs: 678, longformViews: 118000, watchHoursTotal: 2340, shortsViews90d: 960000,  longRPM: 4.20, shortsRPM: 0.10 },
    { date: "2026-06-24", totalSubs: 720, longformViews: 129000, watchHoursTotal: 2530, shortsViews90d: 1100000, longRPM: 4.20, shortsRPM: 0.10 },
    { date: "2026-07-01", totalSubs: 762, longformViews: 141000, watchHoursTotal: 2730, shortsViews90d: 1250000, longRPM: 4.30, shortsRPM: 0.10 },
    { date: "2026-07-08", totalSubs: 800, longformViews: 154000, watchHoursTotal: 2940, shortsViews90d: 1410000, longRPM: 4.30, shortsRPM: 0.10 },
    { date: "2026-07-15", totalSubs: 835, longformViews: 168000, watchHoursTotal: 3160, shortsViews90d: 1580000, longRPM: 4.30, shortsRPM: 0.11 },
    { date: "2026-07-22", totalSubs: 866, longformViews: 183000, watchHoursTotal: 3390, shortsViews90d: 1760000, longRPM: 4.30, shortsRPM: 0.11 }
  ],
  videos: [
    { id: "v1", title: "Getting started: full beginner guide", type: "long",  publishDate: "2026-04-05", publishTime: "18:00", description: "Step-by-step walkthrough for total beginners — setup, first upload, and the basic settings that matter." },
    { id: "v2", title: "60-second pro tip #1",                  type: "short", publishDate: "2026-06-01", publishTime: "12:30", description: "Quick Shorts tip on hooking viewers in the first 3 seconds." }
  ],
  videoSnapshots: [
    { videoId: "v1", date: "2026-04-12", views: 3200,  likes: 210, comments: 34, watchHours: 180 },
    { videoId: "v1", date: "2026-05-01", views: 8100,  likes: 520, comments: 71, watchHours: 460 },
    { videoId: "v1", date: "2026-06-01", views: 15400, likes: 980, comments: 130, watchHours: 890 },
    { videoId: "v1", date: "2026-07-01", views: 24800, likes: 1520, comments: 205, watchHours: 1450 },
    { videoId: "v1", date: "2026-07-22", views: 31200, likes: 1910, comments: 260, watchHours: 1830 },
    { videoId: "v2", date: "2026-06-10", views: 42000,  likes: 3100, comments: 180, watchHours: 40 },
    { videoId: "v2", date: "2026-06-24", views: 190000, likes: 12800, comments: 640, watchHours: 165 },
    { videoId: "v2", date: "2026-07-08", views: 410000, likes: 26500, comments: 1120, watchHours: 350 },
    { videoId: "v2", date: "2026-07-22", views: 620000, likes: 39000, comments: 1580, watchHours: 520 }
  ],
  settings: {
    goalSubs: 1000,
    goalDate: "2026-10-15",
    targetLongRPM: 4.30,
    targetShortsRPM: 0.11,
    theme: "dark"
  }
};
