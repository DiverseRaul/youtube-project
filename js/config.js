/* ============================================================
   config.js — optional sync settings

   Leave this empty and the app works exactly as before: everything
   stays in this browser, no account, no network.

   To turn on cross-device sync, create a free Supabase project and paste
   its URL and *anon public* key below. Both are safe to commit — the anon
   key is meant to be public, and row-level security (see sql/setup.sql)
   is what stops anyone reading anyone else's data.

   You can also paste them into the app itself (Backup tab → Sync across
   devices) if you'd rather not edit files; filling them in here means every
   device that loads your site is already configured.
   ============================================================ */
window.YT_CONFIG = {
  supabaseUrl: "",      // e.g. "https://abcdefghijk.supabase.co"
  supabaseAnonKey: ""   // the long "anon public" key from Settings → API
};
