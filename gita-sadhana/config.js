// GITA SADHANA configuration. The publishable (anon) key is safe to ship in a web app:
// every table is protected by Row Level Security so each child only sees their own data.
window.GS_CONFIG = {
  supabaseUrl: 'https://xmyxqwktmefohpruywom.supabase.co',
  supabaseKey: 'sb_publishable_vancGmofNe_yGvk2TEAtXg_eoxOjb4X',
  explainFunction: 'explain-shloka',      // Supabase Edge Function for Tool 4 (needs ANTHROPIC_API_KEY secret)
  timezone: 'Asia/Kolkata',
  speechLang: 'hi-IN',                    // Devanagari speech recognition (closest browser option for Sanskrit)
  defaultReminderTime: '09:00'
};
