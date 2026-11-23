/* GITA SADHANA v2 – app (vanilla JS, mobile-first). Cloud: Supabase. */
(() => {
'use strict';
const CFG = window.GS_CONFIG || {};
const E = window.GSEngine;
const $app = document.getElementById('app'), $nav = document.getElementById('nav');
const TZ = CFG.timezone || 'Asia/Kolkata';
const SOG = (c, v) => `https://www.holy-bhagavad-gita.org/chapter/${c}/verse/${v}/`;
const SOG_APP = 'https://thegita.app/';

// ---------------- helpers ----------------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const nowTimeIST = () => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const prettyDate = (ds, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) => new Date(ds + 'T12:00:00+05:30').toLocaleDateString('en-IN', Object.assign({ timeZone: TZ }, opts));
const addDays = (ds, n) => { const d = new Date(ds + 'T12:00:00+05:30'); d.setUTCDate(d.getUTCDate() + n); return todayStr(d); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const fmtDur = s => { s = Math.round(s || 0); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : m ? `${m} min ${s % 60 ? (s % 60) + 's' : ''}`.trim() : `${s}s`; };
const timeOf = iso => iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : '';
const key = (c, v) => c + '.' + v;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => { const r = Math.random() * 16 | 0; return (ch === 'x' ? r : (r & 3 | 8)).toString(16); }));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const devNum = n => String(n).replace(/\d/g, d => '०१२३४५६७८९'[d]);
function toast(msg, ms = 2800) { document.querySelectorAll('.toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
const friendlyErr = e => { const m = String((e && e.message) || e || ''); return /fetch|network|Failed to fetch|NetworkError|Load failed/i.test(m) ? 'No internet connection. Please check your connection.' : m; };

// ---------------- cloud status ----------------
function setCloud(ok, e) { S.cloud = { ok, msg: ok ? '' : friendlyErr(e) }; paintCloud(); }
function paintCloud() {
  const el = document.getElementById('cloudpill'); if (!el) return;
  const pending = Sync.q.length, c = S.cloud;
  if (store.kind === 'local') { el.className = 'cloud warn'; el.innerHTML = '📱 Test mode'; return; }
  if (pending && c.ok === false) { el.className = 'cloud bad'; el.innerHTML = `⚠️ ${pending} not saved · <button class="linkbtn" data-a="syncRetry">Retry</button>`; }
  else if (pending) { el.className = 'cloud'; el.innerHTML = '<span class="spin sm"></span> Saving…'; }
  else if (c.ok === false) { el.className = 'cloud bad'; el.innerHTML = '⚠️ Offline · <button class="linkbtn" data-a="syncRetry">Retry</button>'; }
  else if (c.ok) { el.className = 'cloud ok'; el.innerHTML = '☁️ Saved'; }
  else { el.className = 'cloud'; el.innerHTML = '☁️ Connecting…'; }
}
// Writes go through one queue so nothing is lost when the internet drops, and nothing is reported as saved before it is.
const Sync = {
  q: [], busy: false,
  run(label, fn) { this.q.push({ label, fn }); paintCloud(); return this.flush(); },
  async flush() {
    if (this.busy) return; this.busy = true;
    try {
      while (this.q.length) {
        try { await this.q[0].fn(); this.q.shift(); setCloud(true); }
        catch (e) { console.warn('save failed', this.q[0].label, e); setCloud(false, e); if (!S.ui.syncWarned) { S.ui.syncWarned = true; toast('⚠️ Not saved to the cloud yet: ' + friendlyErr(e) + ' I will retry.'); } break; }
      }
    } finally { this.busy = false; paintCloud(); }
  },
  async drain() { await this.flush(); if (this.q.length) throw new Error('Some answers are not saved yet. Please check your internet and tap Retry first.'); }
};
window.addEventListener('online', () => { S.ui.syncWarned = false; Sync.flush(); });
window.addEventListener('offline', () => setCloud(false, new Error('Failed to fetch')));

// ---------------- data stores ----------------
class SupaStore {
  constructor() { this.kind = 'cloud'; this.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); }
  async user() { const { data, error } = await this.sb.auth.getSession(); if (error) throw error; return data.session ? data.session.user : null; }
  async sendOtp(email, name) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { display_name: name }, emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
  }
  async verifyOtp(email, token) {
    let r = await this.sb.auth.verifyOtp({ email, token, type: 'email' });
    if (r.error) { const r2 = await this.sb.auth.verifyOtp({ email, token, type: 'signup' }).catch(() => null); if (r2 && !r2.error) r = r2; }
    if (r.error) throw r.error; return r.data.user;
  }
  async signOut() { await this.sb.auth.signOut(); }
  async _t(p) { try { const { data, error } = await p; if (error) throw error; setCloud(true); return data; } catch (e) { setCloud(false, e); throw e; } }
  async list(table, match = {}, order) {
    let out = [], from = 0;
    for (;;) {
      let q = this.sb.from(table).select('*').match(match);
      if (order) q = q.order(order, { ascending: true });
      const data = await this._t(q.range(from, from + 999));
      out = out.concat(data); if (data.length < 1000) return out; from += 1000;
    }
  }
  async ping() { await this._t(this.sb.from('gs_chapters').select('chapter_number').limit(1)); }
  async insert(table, row) { return this._t(this.sb.from(table).insert(row).select().single()); }
  async upsert(table, row, onConflict) { const d = await this._t(this.sb.from(table).upsert(row, { onConflict }).select()); return d && d[0]; }
  async update(table, match, patch) { await this._t(this.sb.from(table).update(patch).match(match)); }
  async remove(table, match) { await this._t(this.sb.from(table).delete().match(match)); }
  async rpc(fn, args) { return this._t(this.sb.rpc(fn, args)); }
  async invoke(fn, body) { const { data, error } = await this.sb.functions.invoke(fn, { body }); if (error) { let msg = error.message; try { const j = await error.context.json(); msg = j.error || msg; } catch (e) {} throw new Error(msg); } return data; }
  async upload(path, blob) { const { error } = await this.sb.storage.from('gs-recordings').upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true }); if (error) throw error; }
  async removeFiles(paths) { if (!paths.length) return; const { error } = await this.sb.storage.from('gs-recordings').remove(paths); if (error) throw error; }
  async fileUrl(path) { const { data, error } = await this.sb.storage.from('gs-recordings').createSignedUrl(path, 600); if (error) throw error; return data.signedUrl; }
  async deleteAccount() { await this.rpc('gs_delete_my_account'); await this.sb.auth.signOut(); }
}
// Test-only store (open the app with ?test=local). Not offered to users.
class LocalStore {
  constructor() { this.kind = 'local'; this.ns = 'gs_local_'; this.u = { id: '00000000-0000-4000-8000-000000000001', email: 'test@device' }; }
  _get(t) { try { return JSON.parse(localStorage.getItem(this.ns + t) || '[]'); } catch (e) { return []; } }
  _set(t, rows) { localStorage.setItem(this.ns + t, JSON.stringify(rows)); }
  async user() { return localStorage.getItem(this.ns + 'on') ? this.u : null; }
  async sendOtp(email, name) { this.pending = { email, name }; }
  async verifyOtp(email, token) { if (token !== '123456') throw new Error('Token has expired or is invalid'); localStorage.setItem(this.ns + 'on', '1'); return this.u; }
  async signOut() { localStorage.removeItem(this.ns + 'on'); }
  async ping() { setCloud(true); }
  _m(r, match) { return Object.entries(match).every(([k, v]) => r[k] === v); }
  async list(t, match = {}) { return this._get(t).filter(r => this._m(r, match)); }
  async insert(t, row) { const rows = this._get(t); const r = Object.assign({ id: uid(), created_at: new Date().toISOString() }, row); rows.push(r); this._set(t, rows); return r; }
  async upsert(t, row, onConflict) {
    const keys = onConflict.split(','); const rows = this._get(t);
    const i = rows.findIndex(r => keys.every(k => r[k] === row[k]));
    let r; if (i >= 0) { r = rows[i] = Object.assign(rows[i], row); } else { r = Object.assign({ id: uid(), created_at: new Date().toISOString() }, row); rows.push(r); }
    this._set(t, rows); return r;
  }
  async update(t, match, patch) { const rows = this._get(t); rows.forEach(r => { if (this._m(r, match)) Object.assign(r, patch); }); this._set(t, rows); }
  async remove(t, match) {
    this._set(t, this._get(t).filter(r => !this._m(r, match)));
    if (t === 'gs_sessions') { const ids = new Set(this._get('gs_sessions').map(s => s.id)); this._set('gs_attempts', this._get('gs_attempts').filter(a => ids.has(a.session_id))); }
  }
  async rpc(fn) {
    if (fn !== 'gs_rebuild_progress') throw new Error('Not available in test mode');
    const att = this._get('gs_attempts'), items = new Map();
    att.forEach(a => { const k = a.session_id + '|' + a.chapter + '.' + a.verse; const it = items.get(k) || { c: a.chapter, v: a.verse, ok: 0, f3: false, last: '' }; if (a.result !== 'incorrect') it.ok = it.ok ? Math.min(it.ok, a.attempt_no) : a.attempt_no; if (a.attempt_no === 3 && a.result === 'incorrect') it.f3 = true; if (a.created_at > it.last) it.last = a.created_at; items.set(k, it); });
    const rows = this._get('gs_shloka_progress').map(p => {
      const its = [...items.values()].filter(i => i.c === p.chapter && i.v === p.verse && (i.ok || i.f3)).sort((a, b) => a.last < b.last ? -1 : 1);
      const correct = its.filter(i => i.ok).length, last = its[its.length - 1];
      const manual = p.learned_source === 'manual' && p.learned;
      return Object.assign(p, { times_attempted: its.length, times_correct: correct, first_try_correct: its.filter(i => i.ok === 1).length, learned: manual || correct > 0, learned_source: manual ? 'manual' : correct ? 'app' : null, needs_revision: !!(last && !last.ok), last_result: last ? (last.ok ? 'correct-' + last.ok : 'needs-revision') : null });
    }).filter(p => p.times_attempted || p.bookmarked || p.learned);
    this._set('gs_shloka_progress', rows);
  }
  async invoke() { throw new Error('not configured in test mode'); }
  async upload() { throw new Error('Recordings need the cloud.'); }
  async removeFiles() {} async fileUrl() { return ''; }
  async deleteAccount() { Object.keys(localStorage).filter(k => k.startsWith(this.ns)).forEach(k => localStorage.removeItem(k)); }
}
const cloudReady = !!(window.supabase && CFG.supabaseUrl && CFG.supabaseKey);
const testMode = /[?&]test=local\b/.test(location.search);
let store = (testMode || !cloudReady) ? new LocalStore() : new SupaStore();

// ---------------- state ----------------
const S = { tab: 'home', sub: null, user: null, profile: null, progress: new Map(), sessions: [], attempts: [], landmarks: [], links: [], assessments: [], goals: [], manual: null, reminders: null, callLogs: [], recordings: [], rev: null, link: { c: 1, v: 1 }, lib: { c: null, q: '', v: null, view: 'both' }, mean: { c: 1, v: 1, res: null }, cloud: { ok: null, msg: '' }, voice: { mic: 'unknown' }, ui: {} };
const DATA = { shlokas: [], chapters: [], byKey: new Map(), total: 0 };
const V = (c, v) => DATA.byKey.get(key(c, v));
const CH = n => DATA.chapters[n - 1];

async function loadData() {
  const res = await fetch('data/shlokas.json?v=2026-11-23b'); if (!res.ok) throw new Error('Could not load the shloka library (' + res.status + ').');
  const j = await res.json();
  DATA.shlokas = j.shlokas; DATA.chapters = j.chapters; DATA.source = j.source; DATA.notes = j.notes; DATA.total = j.shlokas.length;
  j.shlokas.forEach(s => DATA.byKey.set(key(s.c, s.v), s));
}
async function loadUser() {
  const id = S.user.id;
  const opt = p => p.catch(() => []);
  const [profiles, prog, sessions, attempts, lms, links, assess, manual, rem, calls, recs, goals] = await Promise.all([
    store.list('gs_profiles', { id }), store.list('gs_shloka_progress', { user_id: id }), store.list('gs_sessions', { user_id: id }, 'started_at'),
    store.list('gs_attempts', { user_id: id }, 'created_at'), store.list('gs_landmarks', { user_id: id }), store.list('gs_links', { user_id: id }),
    store.list('gs_level_assessments', { user_id: id }, 'created_at'), store.list('gs_manual_progress', { user_id: id }), store.list('gs_reminders', { user_id: id }),
    opt(store.list('gs_call_logs', { user_id: id }, 'created_at')), opt(store.list('gs_recordings', { user_id: id }, 'created_at')), opt(store.list('gs_goals', { user_id: id }, 'created_at'))]);
  const metaName = (S.user.user_metadata && S.user.user_metadata.display_name) || '';
  const wanted = (S.ui.pendingName || '').trim();
  S.profile = Object.assign({ daily_goal: 5, accuracy_target: 99, monthly_goal: 60, save_recordings: false }, profiles[0] || await store.upsert('gs_profiles', { id, display_name: wanted || metaName || (S.user.email || 'Friend').split('@')[0] }, 'id'));
  if (wanted && S.profile.display_name !== wanted) { await store.update('gs_profiles', { id }, { display_name: wanted }); S.profile.display_name = wanted; }
  S.ui.pendingName = '';
  S.progress = new Map(prog.map(p => [key(p.chapter, p.verse), p]));
  S.sessions = sessions; S.attempts = attempts; S.landmarks = lms; S.links = links; S.assessments = assess; S.goals = goals;
  S.manual = manual[0] || null; S.reminders = rem[0] || await store.upsert('gs_reminders', { user_id: id }, 'user_id'); S.callLogs = calls; S.recordings = recs;
  if (!S.reminders.call_time) S.reminders.call_time = CFG.defaultReminderTime || '09:00';
}

// ---------------- statistics (single source of truth) ----------------
function items(filter) {
  const m = new Map();
  for (const a of S.attempts) {
    if (filter && !filter(a)) continue;
    const k = a.session_id + '|' + a.chapter + '.' + a.verse;
    let it = m.get(k); if (!it) { it = { session_id: a.session_id, c: a.chapter, v: a.verse, date: a.local_date, tries: 0, correctAt: 0, failed: false, mistakes: [] }; m.set(k, it); }
    it.tries = Math.max(it.tries, a.attempt_no);
    if (a.result === 'correct' || a.result === 'manual_correct') { if (!it.correctAt || a.attempt_no < it.correctAt) it.correctAt = a.attempt_no; }
    else { it.mistakes.push(a); if (a.attempt_no === 3) it.failed = true; }
  }
  for (const it of m.values()) if (it.correctAt) it.failed = false;
  return [...m.values()].filter(it => it.correctAt || it.failed);
}
function sumItems(its) {
  const t = its.length, c1 = its.filter(i => i.correctAt === 1).length, c2 = its.filter(i => i.correctAt === 2).length, c3 = its.filter(i => i.correctAt === 3).length;
  return { total: t, c1, c2, c3, correct: c1 + c2 + c3, failed: t - c1 - c2 - c3, acc: pct(c1 + c2 + c3, t), firstAcc: pct(c1, t) };
}
function activeDates() { return [...new Set(S.attempts.map(a => a.local_date).concat(S.landmarks.map(l => l.local_date)))].sort(); }
function streaks() {
  const ds = new Set(S.attempts.map(a => a.local_date)); const today = todayStr();
  let cur = 0, d = ds.has(today) ? today : addDays(today, -1);
  while (ds.has(d)) { cur++; d = addDays(d, -1); }
  let best = 0, run = 0, prev = null;
  [...ds].sort().forEach(x => { run = prev && dayDiff(prev, x) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = x; });
  return { cur, best, practisedToday: ds.has(today) };
}
function learnedSet() {
  const s = new Set(); S.progress.forEach((p, k) => { if (p.learned) s.add(k); });
  if (S.manual) (S.manual.chapters_completed || []).forEach(c => { for (let v = 1; v <= CH(c).count; v++) s.add(key(c, v)); });
  return s;
}
function appLearnedSet() { const s = new Set(); S.progress.forEach((p, k) => { if (p.learned) s.add(k); }); return s; }
function chapterDone(c, set) { for (let v = 1; v <= CH(c).count; v++) if (!set.has(key(c, v))) return false; return true; }
function stats() {
  const L = learnedSet(), today = todayStr(), month = today.slice(0, 7);
  const chaptersDone = DATA.chapters.filter(ch => chapterDone(ch.n, L)).map(ch => ch.n);
  const revised = new Set(S.attempts.map(a => key(a.chapter, a.verse)));
  const todayVerses = new Set(S.attempts.filter(a => a.local_date === today).map(a => key(a.chapter, a.verse)));
  const monthVerses = new Set(S.attempts.filter(a => a.local_date.startsWith(month)).map(a => key(a.chapter, a.verse)));
  const memorised = [...S.progress.values()].filter(p => p.first_try_correct >= 2).length;
  const all = sumItems(items());
  const manualLearned = S.manual ? S.manual.shlokas_learned || 0 : 0;
  return { L, learned: Math.max(L.size, manualLearned), chaptersDone, revised: revised.size, todayCount: todayVerses.size, monthCount: monthVerses.size, memorised: Math.max(memorised, S.manual ? S.manual.shlokas_memorised || 0 : 0), all, streak: streaks() };
}
function currentChapter() { const last = S.attempts[S.attempts.length - 1]; return S.profile.current_chapter || (last ? last.chapter : 1); }

// ---------------- voice coach (browser) ----------------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const VOICE_ERR = {
  denied: 'Microphone permission is blocked. Tap the 🔒 lock icon next to the web address, allow the Microphone, then tap Retry.',
  nomic: 'No microphone was found. Please connect one (or use your phone), then tap Retry.',
  network: 'Voice recognition needs the internet and could not connect. Check your connection, then tap Retry.',
  timeout: 'The microphone is taking too long to start. Tap Retry – or close other apps that use the mic.',
  unsupported: 'This browser cannot listen to chanting. Please use Chrome on Android/computer or Safari on iPhone – or type instead.',
  busy: 'The microphone is busy in another app or tab. Close it, then tap Retry.',
  error: 'Something went wrong with the microphone. Tap Retry or type instead.'
};
const Voice = {
  canListen: !!SR, canSpeak: 'speechSynthesis' in window, speakId: 0, speaking: false,
  pick(lang) {
    if (!this.canSpeak) return null;
    const vs = speechSynthesis.getVoices(), l2 = lang.slice(0, 2), norm = v => (v.lang || '').replace('_', '-');
    const prefs = lang === 'en-IN' ? [/Neerja/i, /Heera/i, /Google.*English.*India/i, /Veena/i, /Isha/i, /Rishi/i, /Female/i] : [/Swara/i, /Google.*हिन्दी/i, /Lekha/i, /Kalpana/i];
    const local = vs.filter(v => norm(v) === lang);
    for (const re of prefs) { const v = local.find(x => re.test(x.name)); if (v) return v; }
    return local[0] || vs.find(v => norm(v).startsWith(l2)) || null;
  },
  speak(text, lang = 'en-IN') {
    const id = ++this.speakId;
    return new Promise(res => {
      if (!this.canSpeak || S.ui.mute || !text) return res();
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '').replace(/[ऀ-ॿ]+…?/g, ''));
        u.lang = lang; const v = this.pick(lang); if (v) u.voice = v;
        u.rate = lang === 'en-IN' ? 1.06 : 0.85; u.pitch = lang === 'en-IN' ? 1.12 : 1;
        let done = false; const fin = () => { if (!done) { done = true; if (id === this.speakId) { this.speaking = false; onVoiceChange(); } res(); } };
        u.onend = fin; u.onerror = fin; this.speaking = true; onVoiceChange();
        speechSynthesis.speak(u); setTimeout(fin, Math.min(25000, 3000 + text.length * 85));
      } catch (e) { this.speaking = false; res(); }
    });
  },
  stop() { this.speakId++; this.speaking = false; try { speechSynthesis.cancel(); } catch (e) {} },
  async micState() { try { if (navigator.permissions && navigator.permissions.query) { const p = await navigator.permissions.query({ name: 'microphone' }); return p.state; } } catch (e) {} return 'unknown'; },
  async requestMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return { ok: false, err: 'unsupported' };
    try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach(t => t.stop()); return { ok: true }; }
    catch (e) { return { ok: false, err: e.name === 'NotAllowedError' || e.name === 'SecurityError' ? 'denied' : e.name === 'NotFoundError' ? 'nomic' : e.name === 'NotReadableError' ? 'busy' : 'error' }; }
  },
  listen({ lang, onText, onStart, onFatal }) {
    const rec = new SR(); rec.lang = lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    let finals = [], confs = [], interim = '', stopped = false, started = false, fatal = null, restarts = 0, resolveFn = null;
    const text = () => (finals.join(' ') + ' ' + interim).replace(/\s+/g, ' ').trim();
    const fail = err => { if (fatal || stopped) return; fatal = err; stopped = true; try { rec.abort(); } catch (e) {} onFatal && onFatal(err); };
    rec.onstart = () => { if (!started) { started = true; onStart && onStart(); } };
    rec.onresult = e => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) { finals.push(r[0].transcript); if (r[0].confidence > 0) confs.push(r[0].confidence); } else interim += r[0].transcript; }
      onText && onText(text());
    };
    rec.onerror = e => {
      const m = { 'not-allowed': 'denied', 'service-not-allowed': 'denied', 'audio-capture': 'nomic', network: 'network' }[e.error];
      if (m) fail(m);
    };
    rec.onend = () => {
      if (!stopped && restarts < 30) { restarts++; try { rec.start(); return; } catch (e) { /* fall through */ } }
      if (resolveFn) resolveFn();
    };
    try { rec.start(); } catch (e) { setTimeout(() => fail('error'), 0); }
    const t = setTimeout(() => { if (!started && !fatal) fail('timeout'); }, 7000);
    return {
      stop: () => new Promise(res => {
        clearTimeout(t); stopped = true;
        let done = false; resolveFn = () => { if (done) return; done = true; res({ text: text(), confidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0, error: fatal }); };
        try { rec.stop(); } catch (e) { resolveFn(); }
        setTimeout(() => resolveFn && resolveFn(), 2500);
      }),
      abort: () => { clearTimeout(t); stopped = true; try { rec.abort(); } catch (e) {} }
    };
  }
};
function onVoiceChange() { const el = document.getElementById('coachState'); if (el) el.innerHTML = coachStateHtml(); }
const Recorder = {
  async start() {
    if (!S.profile.save_recordings || store.kind !== 'cloud' || !window.MediaRecorder || !navigator.mediaDevices) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mr = new MediaRecorder(stream); const chunks = [];
      mr.ondataavailable = e => chunks.push(e.data); mr.start();
      return { stop: () => new Promise(res => { mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); res(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); }; mr.stop(); }), abort: () => { try { mr.stop(); } catch (e) {} stream.getTracks().forEach(t => t.stop()); } };
    } catch (e) { return null; }
  }
};
const COACH = {
  welcome: "Hare Krishna! Welcome back, champion! Are you ready to chant today's shlokas? Let's begin!",
  correct: "Excellent! Perfect! Let's move to the next shloka.",
  correctLast: 'Excellent! Perfect! That was the last one – fantastic work!',
  failed: "Good effort, champion! Let's read this shloka together, repeat it slowly, and tap Next when you're ready.",
  prompt: (rev) => { const it = rev.cur; if (rev.mode === 'chapter') return `Shloka ${it.v}! Take a breath, and chant.`; if (rev.mode === 'recall') return `Landmark: ${it.landmark}. That's Chapter ${it.c}, Shloka ${it.v}. Chant it!`; return `Chapter ${it.c}, Shloka ${it.v}. You've got this – please chant!`; }
};

// ---------------- revision engine (shared by voice, text and the phone agent) ----------------
class Revision {
  constructor({ mode, inputType, chapters, queue }) { Object.assign(this, { mode, inputType, chapters, queue, i: 0, attempt: 1, results: [], startedAt: Date.now(), state: 'ask', vstate: 'idle', verr: '', last: null, msg: '', heard: '', sessionId: null, busy: false }); }
  get cur() { return this.queue[this.i]; }
  get verse() { return V(this.cur.c, this.cur.v); }
  check(answer, meta) {
    const r = E.compare(this.verse, answer, { inputType: meta.inputType, asrConfidence: meta.confidence });
    this.last = r;
    if (r.uncertain) return { status: 'uncertain', r, hint: E.hint(r, this.attempt) };
    const rec = { c: this.cur.c, v: this.cur.v, attempt_no: this.attempt, result: r.pass ? (meta.manual ? 'manual_correct' : 'correct') : 'incorrect', score: r.score, confidence: r.confidence, answer, inputType: meta.inputType,
      mistakes: r.words.filter(w => w.status !== 'ok').map(w => ({ pada: w.pada + 1, word: w.text, type: w.status })).concat(r.extras.map(x => ({ type: 'added', text: x.text }))) };
    if (r.pass) { this.results.push({ c: this.cur.c, v: this.cur.v, correctAt: this.attempt }); return { status: 'correct', r, rec }; }
    if (this.attempt < 3) { const hint = E.hint(r, this.attempt); this.attempt++; return { status: 'retry', r, rec, hint }; }
    this.results.push({ c: this.cur.c, v: this.cur.v, correctAt: 0 }); return { status: 'failed', r, rec };
  }
  undoLast(prevStatus) { if (prevStatus === 'retry') this.attempt--; else this.results.pop(); }
  next() { this.i++; this.attempt = 1; this.last = null; this.lastOut = null; this.heard = ''; this.state = 'ask'; this.vstate = 'idle'; return this.i < this.queue.length; }
  summary() {
    const r = this.results, c1 = r.filter(x => x.correctAt === 1).length, c2 = r.filter(x => x.correctAt === 2).length, c3 = r.filter(x => x.correctAt === 3).length;
    return { total: r.length, c1, c2, c3, failed: r.length - c1 - c2 - c3, acc: pct(c1 + c2 + c3, r.length), secs: Math.round((Date.now() - this.startedAt) / 1000), weak: r.filter(x => !x.correctAt) };
  }
}
function persistSessionStart(rev) {
  const row = { id: uid(), user_id: S.user.id, mode: rev.mode, input_type: rev.inputType, chapters: rev.chapters, local_date: todayStr(), started_at: new Date().toISOString(), total: 0, source: 'app' };
  rev.sessionId = row.id; S.sessions.push(row);
  Sync.run('session', () => store.upsert('gs_sessions', row, 'id'));
}
function persistAttempt(rev, rec, blob) {
  const row = { id: uid(), session_id: rev.sessionId, user_id: S.user.id, chapter: rec.c, verse: rec.v, attempt_no: rec.attempt_no, input_type: rec.inputType, answer: (rec.answer || '').slice(0, 2000),
    score: rec.score, confidence: rec.confidence || null, result: rec.result, mistakes: rec.mistakes, local_date: todayStr(), created_at: new Date().toISOString() };
  S.attempts.push(row);
  Sync.run('attempt', async () => {
    await store.upsert('gs_attempts', row, 'id');
    if (blob) { try { const path = `${S.user.id}/${row.id}.webm`; await store.upload(path, blob); const r = await store.upsert('gs_recordings', { id: uid(), user_id: S.user.id, attempt_id: row.id, storage_path: path }, 'id'); S.recordings.push(r); } catch (e) { console.warn('recording upload failed', e); } }
  });
  return row;
}
function persistItemDone(rev, item) {
  const k = key(item.c, item.v), p = Object.assign({ user_id: S.user.id, chapter: item.c, verse: item.v, learned: false, bookmarked: false, needs_revision: false, times_attempted: 0, times_correct: 0, first_try_correct: 0 }, S.progress.get(k) || {});
  p.times_attempted++; p.last_practised_at = new Date().toISOString(); p.updated_at = p.last_practised_at;
  if (item.correctAt) { p.times_correct++; if (item.correctAt === 1) p.first_try_correct++; if (!p.learned) { p.learned = true; p.learned_source = 'app'; } p.needs_revision = false; p.last_result = 'correct-' + item.correctAt; }
  else { p.needs_revision = true; p.last_result = 'needs-revision'; }
  const clean = Object.fromEntries(Object.entries(p).filter(([k2]) => !['id', 'created_at'].includes(k2)));
  S.progress.set(k, clean);
  Sync.run('progress', () => store.upsert('gs_shloka_progress', clean, 'user_id,chapter,verse'));
  persistSessionTotals(rev, false);
}
function persistSessionTotals(rev, completed) {
  const s = rev.summary();
  const patch = { total: s.total, correct_first: s.c1, correct_second: s.c2, correct_third: s.c3, failed: s.failed, accuracy: s.acc, duration_sec: s.secs, ended_at: new Date().toISOString(), completed };
  const row = S.sessions.find(x => x.id === rev.sessionId); if (row) Object.assign(row, patch);
  const id = rev.sessionId;
  Sync.run('session-totals', () => store.update('gs_sessions', { id }, patch));
}

// ---------------- small UI pieces ----------------
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>',
  revise: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3z"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>',
  course: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 21V5M9 7h6M9 11h6"/></svg>',
  tools: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3z"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>'
};
const LOTUS = `<svg class="lotus" viewBox="0 0 200 110" aria-hidden="true"><g transform="translate(100 92)"><ellipse rx="78" ry="9" fill="#DCEBD5"/>
<path d="M0-6C-14-30-12-58 0-80C12-58 14-30 0-6Z" fill="#F7B267"/><path d="M-4-6C-30-18-44-42-44-64C-24-56-10-36-4-6Z" fill="#F9C784"/><path d="M4-6C30-18 44-42 44-64C24-56 10-36 4-6Z" fill="#F9C784"/>
<path d="M-6-4C-40-6-62-24-72-40C-46-42-22-28-6-4Z" fill="#FCE3C6"/><path d="M6-4C40-6 62-24 72-40C46-42 22-28 6-4Z" fill="#FCE3C6"/><circle cy="-10" r="5" fill="#E9A23B"/></g></svg>`;
const FEATHER = `<svg class="feather" viewBox="0 0 120 200" aria-hidden="true"><path d="M60 196C58 140 56 90 60 20" stroke="#8A6A2A" stroke-width="2" fill="none"/>
<ellipse cx="60" cy="58" rx="34" ry="52" fill="#3E9A7E" opacity=".55"/><ellipse cx="60" cy="52" rx="22" ry="32" fill="#1F6F78"/><ellipse cx="60" cy="50" rx="13" ry="18" fill="#E9B949"/><ellipse cx="60" cy="49" rx="7" ry="10" fill="#173A6B"/></svg>`;
const AV = `<div class="av">${FEATHER.replace('class="feather"', 'width="26" height="40"')}</div>`;
function ring(value, max, label, color = '#EE8A2E', sub = '') {
  const p = max ? Math.min(1, value / max) : 0, C = 2 * Math.PI * 46;
  return `<div class="ring"><svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="46" fill="none" stroke="#F1E6D2" stroke-width="11"/><circle cx="55" cy="55" r="46" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}"/></svg><div class="lbl"><b>${label}</b><span>${sub}</span></div></div>`;
}
const barRow = (label, v, max, txt, cls = '') => `<div class="barrow"><span>${label}</span><div class="bar ${cls}"><i style="width:${max ? Math.min(100, 100 * v / max) : 0}%"></i></div><span class="v">${txt}</span></div>`;
const cols = arr => `<div class="cols">${arr.map(a => `<div class="c"><b>${a.v === null ? '' : a.v + (a.unit || '')}</b><i style="height:${Math.max(2, a.h)}%"></i><span>${esc(a.l)}</span></div>`).join('')}</div>`;
const chapterOptions = sel => DATA.chapters.map(c => `<option value="${c.n}" ${+sel === c.n ? 'selected' : ''}>Chapter ${c.n} – ${esc(c.name)}</option>`).join('');
const verseOptions = (c, sel) => Array.from({ length: CH(c).count }, (_, i) => `<option value="${i + 1}" ${+sel === i + 1 ? 'selected' : ''}>Shloka ${i + 1}</option>`).join('');
function header(title, back) {
  const right = S.user ? `<span id="cloudpill" class="cloud" aria-live="polite"></span>${back ? '' : `<button class="avatar" data-a="go" data-t="profile" aria-label="My profile">${esc((S.profile && S.profile.display_name || '?').trim().charAt(0).toUpperCase())}</button>`}` : '';
  return `<div class="top">${back ? `<button class="btn ghost small" data-a="${back}" aria-label="Back">←</button>` : `<svg class="logo" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#FCE3C6"/><path d="M24 36c-6-6-6-14 0-22 6 8 6 16 0 22z" fill="#EE8A2E"/><path d="M23 36c-8-2-12-8-12-15 7 2 11 8 12 15zM25 36c8-2 12-8 12-15-7 2-11 8-12 15z" fill="#F7B267"/></svg>`}
  <div class="grow"><div class="t">${esc(title)}</div>${back ? '' : '<div class="s">Your AI Chanting Companion</div>'}</div>${right}</div>`;
}
// Sanskrit display: line by line, pada by pada; words are never split, dandas in the right place.
function verseText(v, opts = {}) {
  const bad = opts.badWords || new Set(), missing = opts.missing || new Set(), badPadas = opts.badPadas || new Set();
  if (opts.view === 'iast') {
    const tr = t => E.iastToEasy(E.devToIast(t)).replace(/\s+/g, ' ').trim();
    return `<div class="rom" lang="sa-Latn">${v.spk ? `<div class="spk">${esc(tr(v.spk))}</div>` : ''}${v.lines.map((l, i) => `<div>${esc(tr(l))}${i === v.lines.length - 1 && !opts.noNumber ? `&nbsp;<span class="nb">||&nbsp;${v.v}&nbsp;||</span>` : ''}</div>`).join('')}</div>`;
  }
  let pi = 0, wi = 0;
  const pl = v.pl || v.padas.map((_, i) => Math.floor(i / 2)), pj = v.pj || v.padas.map(() => 0);
  const lines = v.lines.map((line, li) => {
    const words = line.split(/\s+/).filter(Boolean); let lw = 0, rem = 0, html = '';
    while (pi < v.padas.length && pl[pi] === li) {
      const toks = v.padas[pi].split(/\s+/).filter(Boolean).map(t => {
        if (rem <= 0) { rem = (words[lw++] || t).length; wi++; }
        const idx = wi - 1; rem -= t.length;
        return `<span class="${bad.has(idx) ? 'w-wrong' : missing.has(idx) ? 'w-missing' : ''}">${esc(t)}</span>`;
      }).join(' ');
      html += `<span class="pada${badPadas.has(pi) ? ' pada-bad' : ''}">${toks}</span>${pj[pi] ? '' : ' '}`;
      pi++;
    }
    const end = li === v.lines.length - 1 ? (opts.noNumber ? '॥' : `॥&nbsp;${devNum(v.v)}&nbsp;॥`) : '।';
    return `<div class="ln">${html.trim()}&nbsp;<span class="nb">${end}</span></div>`;
  });
  return `<div class="sa" lang="sa">${v.spk ? `<div class="spk">${esc(v.spk)}</div>` : ''}${lines.join('')}</div>`;
}
function confirmBox(title, body, okLabel, fn, danger = true) { S.ui.confirm = { title, body, okLabel, fn, danger }; S.ui.keepScroll = true; render(); }
function viewConfirm() {
  const c = S.ui.confirm;
  return `<div class="modal-bg" role="presentation"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="cft"><h2 id="cft">${esc(c.title)}</h2><p>${esc(c.body)}</p>
   <div class="row"><button class="btn ghost grow" data-a="confirmNo">Cancel</button><button class="btn ${c.danger ? 'danger' : 'green'} grow" data-a="confirmYes">${esc(c.okLabel)}</button></div></div></div>`;
}

// ---------------- AUTH (name + email + code) ----------------
function viewAuth() {
  const step = S.ui.otpEmail ? 'code' : 'email';
  return `<div style="max-width:440px;margin:0 auto">
  <div class="card hero center" style="padding-top:26px">${FEATHER}${LOTUS}<h1 style="margin-top:6px">Gita Sadhana</h1><p class="muted">One shloka at a time, one chapter at a time, every day. Hare Krishna! 🙏</p></div>
  <div class="card">
   ${step === 'email' ? `<h2>Welcome, champion!</h2><p class="small muted">No password needed. I'll email you a code.</p>
   <form data-f="otpSend">
    <label for="an">Your name</label><input id="an" name="name" autocomplete="given-name" maxlength="40" placeholder="e.g. Radha" value="${esc(S.ui.pendingName || '')}">
    <label for="ae">Email</label><input id="ae" name="email" type="email" autocomplete="email" required placeholder="you@example.com" value="${esc(S.ui.lastEmail || '')}">
    <div class="sp"></div><button class="btn big" type="submit" ${S.ui.authBusy ? 'disabled' : ''}>${S.ui.authBusy ? '<span class="spin"></span> Sending…' : 'Send my code ✉️'}</button>
   </form>` : `<h2>Check your email ✉️</h2><p class="small">I sent a code to <b>${esc(S.ui.otpEmail)}</b>. Type it below – or just tap the link in that email.</p>
   <form data-f="otpVerify">
    <label for="ac">Code from the email</label><input id="ac" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required placeholder="123456" style="font-size:24px;letter-spacing:6px;text-align:center">
    <div class="sp"></div><button class="btn big" type="submit" ${S.ui.authBusy ? 'disabled' : ''}>${S.ui.authBusy ? '<span class="spin"></span> Checking…' : 'Enter Gita Sadhana 🪷'}</button>
   </form>
   <div class="row" style="margin-top:10px;justify-content:space-between"><button class="linkbtn small" style="width:auto;text-decoration:underline" data-a="otpBack">Use a different email</button>
    <button class="linkbtn small" style="width:auto;text-decoration:underline" data-a="otpResend">Send a new code</button></div>`}
   ${S.ui.authMsg ? `<div class="banner ${S.ui.authErr ? 'warn' : 'ok'}" style="margin-top:12px" role="alert">${esc(S.ui.authMsg)}</div>` : ''}
   ${!cloudReady ? '<div class="banner warn">The cloud is not configured – progress cannot be saved.</div>' : ''}
  </div>
  <p class="center small muted">Your progress is saved privately in the cloud and stays signed in on this device.</p></div>`;
}

// ---------------- HOME ----------------
function viewHome() {
  const st = stats(), p = S.profile, goal = p.daily_goal || 5, today = todayStr();
  const lastAssess = S.assessments[S.assessments.length - 1];
  const levelDue = !lastAssess || dayDiff(lastAssess.created_at.slice(0, 10), today) >= 15;
  const remindDue = S.reminders && S.reminders.in_app_enabled && !st.streak.practisedToday && nowTimeIST() >= (S.reminders.call_time || '09:00').slice(0, 5);
  const weak = [...S.progress.values()].filter(x => x.needs_revision).length;
  const cc = currentChapter(); let ccDone = 0; for (let v = 1; v <= CH(cc).count; v++) if (st.L.has(key(cc, v))) ccDone++;
  return `${header('Gita Sadhana')}
  ${store.kind === 'local' ? '<div class="banner warn">🧪 Test mode – nothing is saved to the cloud.</div>' : ''}
  ${S.cloud.ok === false ? `<div class="banner warn">⚠️ Can't reach the cloud: ${esc(S.cloud.msg)} <button class="btn small" data-a="syncRetry">Retry</button></div>` : ''}
  ${remindDue ? `<div class="banner info">🔔 Hare Krishna! It's time for your Bhagavad Gita Sadhana. Shall we revise today's shlokas? <button class="btn small peacock" data-a="go" data-t="revise">Start</button></div>` : ''}
  <div class="card hero">${FEATHER}<div class="muted small">${esc(prettyDate(today))}</div><h1 style="max-width:80%">Hare Krishna, ${esc(p.display_name || 'champion')}! 🙏</h1>
   <p style="max-width:78%">${st.streak.practisedToday ? 'Wonderful – you have practised today. Keep shining! 🌟' : st.streak.cur ? `Your ${st.streak.cur}-day streak is waiting for today's chanting 🔥` : "Let's begin today's chanting together. 😊"}</p>
   <button class="btn" data-a="go" data-t="revise">${ICON.mic.replace('<svg', '<svg width="22" height="22"')} Start Shloka Revision</button></div>
  <div class="card"><div class="row" style="align-items:center;gap:16px">${ring(st.todayCount, goal, `${st.todayCount}/${goal}`, '#4E7D4B', 'today')}
   <div class="grow"><h3>Today's learning progress</h3><p class="small muted">Daily goal: <b>${goal} shlokas</b>. ${st.todayCount >= goal ? 'Goal reached – super! 🎉' : `${goal - st.todayCount} more to reach your goal.`}</p>
   <form data-f="goal" class="row"><input name="goal" type="number" min="1" max="100" value="${goal}" style="width:90px" aria-label="Daily goal"><button class="btn small ghost">Set goal</button></form></div></div></div>
  <div class="grid4">
   <div class="stat"><b>🔥 ${st.streak.cur}</b><span>day streak</span></div>
   <div class="stat"><b>${st.chaptersDone.length}<small style="font-size:15px">/18</small></b><span>chapters completed</span></div>
   <div class="stat"><b>${st.learned}</b><span>shlokas learned</span></div>
   <div class="stat"><b>${st.revised}</b><span>shlokas revised</span></div></div><div class="sp"></div>
  <button class="card linkbtn" data-a="go" data-t="course"><div class="row"><div style="font-size:30px">📖</div><div class="grow"><b>My Course · Chapter ${cc}</b><div class="small muted">${esc(CH(cc).name)} – ${ccDone}/${CH(cc).count} shlokas learned</div><div class="bar green" style="margin-top:6px"><i style="width:${pct(ccDone, CH(cc).count)}%"></i></div></div><span>›</span></div></button>
  ${levelDue ? '<div class="banner warn">📝 Time for your 15-day "Your Level" check. <button class="btn small" data-a="tool" data-t="level">Open</button></div>' : ''}
  ${weak ? `<div class="banner info">🪷 ${weak} shloka${weak > 1 ? 's are' : ' is'} waiting for a little more practice. <button class="btn small peacock" data-a="quickWeak">Revise</button></div>` : ''}
  <div class="grid3">
   <button class="card linkbtn center" data-a="go" data-t="revise"><div style="font-size:30px">📿</div><b>Shloka Revision</b></button>
   <button class="card linkbtn center" data-a="go" data-t="tools"><div style="font-size:30px">🧰</div><b>Tools</b></button>
   <button class="card linkbtn center" data-a="go" data-t="progress"><div style="font-size:30px">🌱</div><b>Progress</b></button></div>`;
}

// ---------------- MY COURSE ----------------
const MILESTONES = [1, 5, 10, 25, 50, 75, 108, 150, 200, 250, 300, 400, 500, 600, 701];
function viewCourse() {
  const st = stats(), p = S.profile, cc = currentChapter();
  let ccDone = 0; for (let v = 1; v <= CH(cc).count; v++) if (st.L.has(key(cc, v))) ccDone++;
  const inProgress = DATA.chapters.filter(c => !st.chaptersDone.includes(c.n) && (c.n === cc || (S.manual && (S.manual.chapters_learning || []).includes(c.n)) || Array.from({ length: c.count }, (_, i) => st.L.has(key(c.n, i + 1))).some(Boolean))).map(c => c.n);
  const nextCount = MILESTONES.find(m => m > st.learned);
  const left = CH(cc).count - ccDone;
  const goals = S.goals.slice().sort((a, b) => (a.done - b.done) || String(a.due_date || '9').localeCompare(String(b.due_date || '9')));
  const eg = S.ui.editGoal && S.goals.find(g => g.id === S.ui.editGoal);
  return `${header('My Course')}
  <div class="card hero"><div class="row" style="gap:16px">${ring(ccDone, CH(cc).count, `${ccDone}/${CH(cc).count}`, '#EE8A2E', 'this chapter')}
   <div class="grow"><div class="small muted">I am learning</div><h2 style="margin:0">Chapter ${cc}</h2><div>${esc(CH(cc).name)}</div>
    <label for="ccsel" class="small" style="margin-top:8px">Change chapter</label><select id="ccsel" data-ch="courseChapter">${chapterOptions(cc)}</select></div></div></div>
  <div class="card"><h3>🎯 Next milestone</h3>
   ${left > 0 ? `<p>Finish <b>Chapter ${cc}</b> – just <b>${left}</b> shloka${left > 1 ? 's' : ''} to go! 🪷</p>` : `<p>Chapter ${cc} is complete! 🎉 Choose your next chapter above.</p>`}
   ${nextCount ? `<p>Learn <b>${nextCount - st.learned}</b> more to reach <b>${nextCount} shlokas</b> ${nextCount === 108 ? '(a mala of 108! 📿)' : nextCount === 701 ? '(the whole Gita! 🕉️)' : '🌟'}</p>` : '<p>You have learned the whole Gita! 🕉️</p>'}</div>
  <div class="grid2"><div class="stat"><b>${st.learned}<small style="font-size:14px">/${DATA.total}</small></b><span>shlokas learned</span></div><div class="stat"><b>${st.chaptersDone.length}<small style="font-size:14px">/18</small></b><span>chapters completed</span></div></div><div class="sp"></div>
  <div class="card"><h3>Chapters</h3>
   <p class="small"><b>Completed:</b> ${st.chaptersDone.length ? st.chaptersDone.map(n => `<span class="pill green">${n}</span>`).join(' ') : '<span class="muted">none yet – you\'re on your way!</span>'}</p>
   <p class="small"><b>In progress:</b> ${inProgress.map(n => `<span class="pill">${n}</span>`).join(' ') || '<span class="muted">—</span>'}</p></div>
  <div class="card"><h3>📅 My targets</h3>
   ${barRow('Today', st.todayCount, p.daily_goal, `${st.todayCount}/${p.daily_goal}`, 'green')}
   ${barRow('This month', st.monthCount, p.monthly_goal || 60, `${st.monthCount}/${p.monthly_goal || 60}`)}
   <form data-f="targets" class="grid2"><div><label for="tdg">Daily target</label><input id="tdg" name="daily" type="number" min="1" max="100" value="${p.daily_goal}"></div><div><label for="tmg">Monthly target</label><input id="tmg" name="monthly" type="number" min="1" max="2000" value="${p.monthly_goal || 60}"></div>
    <div style="grid-column:1/-1"><button class="btn small ghost">Save targets</button></div></form>
   <p class="small muted">Targets count different shlokas you chant in revision.</p></div>
  <div class="card"><h3>🌟 My learning goals</h3>
   ${goals.length ? `<ul class="list">${goals.map(g => `<li><label class="check" style="margin:0;flex:1"><input type="checkbox" data-ch="goalDone" data-id="${g.id}" ${g.done ? 'checked' : ''}><span style="${g.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(g.title)}${g.chapter ? ` <span class="pill">Ch ${g.chapter}</span>` : ''}${g.due_date ? `<br><span class="small muted">by ${esc(prettyDate(g.due_date, { day: 'numeric', month: 'short', year: 'numeric' }))}</span>` : ''}</span></label>
     <button class="btn small ghost" data-a="editGoal" data-id="${g.id}" aria-label="Edit goal">✏️</button><button class="btn small ghost" data-a="delGoal" data-id="${g.id}" aria-label="Delete goal">🗑</button></li>`).join('')}</ul>` : '<p class="muted">No goals yet. Add one below! 😊</p>'}
   <form data-f="goalSave"><h3 style="margin-top:12px">${eg ? 'Edit goal' : 'Add a goal'}</h3>
    <label for="gt">Goal</label><input id="gt" name="title" required maxlength="200" value="${esc(eg ? eg.title : '')}" placeholder="e.g. Learn Chapter 12 by Gita Jayanti">
    <div class="grid2"><div><label for="gc">Chapter (optional)</label><select id="gc" name="chapter"><option value="">—</option>${chapterOptions(eg ? eg.chapter : '')}</select></div><div><label for="gd">Target date (optional)</label><input id="gd" name="due" type="date" value="${esc(eg && eg.due_date ? eg.due_date : '')}"></div></div>
    <div class="sp"></div><div class="row"><button class="btn">${eg ? 'Save changes' : 'Add goal'}</button>${eg ? '<button type="button" class="btn ghost" data-a="cancelGoal">Cancel</button>' : ''}</div></form></div>`;
}

// ---------------- REVISION: setup ----------------
function micLabel() { const m = S.voice.mic; return m === 'granted' ? '✅ Connected' : m === 'denied' ? '❌ Blocked' : m === 'prompt' ? '⏳ Not yet allowed' : '❔ Not checked yet'; }
function viewVoiceCheck() {
  const online = navigator.onLine !== false;
  return `<div class="card flat voicecheck"><h3>🎙️ Voice check</h3>
   <div class="vrow"><span>Voice recognition in this browser</span><b>${Voice.canListen ? '✅ Ready' : '❌ Not supported'}</b></div>
   <div class="vrow"><span>Microphone</span><b>${micLabel()}</b></div>
   <div class="vrow"><span>Internet</span><b>${online ? '✅ Online' : '❌ Offline'}</b></div>
   ${S.voice.err ? `<div class="banner warn" role="alert">${esc(VOICE_ERR[S.voice.err] || VOICE_ERR.error)}</div>` : ''}
   ${Voice.canListen && S.voice.mic !== 'granted' ? `<button class="btn ghost small" data-a="micCheck" ${S.voice.checking ? 'disabled' : ''}>${S.voice.checking ? '<span class="spin sm"></span> Connecting…' : 'Connect microphone'}</button>` : ''}
   ${Voice.canListen && S.voice.mic === 'granted' ? '<button class="btn ghost small" data-a="voiceTest">🔊 Hear the coach</button>' : ''}</div>`;
}
function viewReviseSetup() {
  const u = S.ui, mode = u.mode || 'A', input = u.input || 'text';
  const sel = u.multi || [];
  return `${header('Shloka Revision')}
  <div class="tabs"><button class="chip ${mode === 'A' ? 'on' : ''}" data-a="setMode" data-m="A">A · Chapter-wise</button><button class="chip ${mode === 'B' ? 'on' : ''}" data-a="setMode" data-m="B">B · Random</button><button class="chip ${mode === 'C' ? 'on' : ''}" data-a="setMode" data-m="C">C · Shloka Linking</button></div>
  ${mode === 'C' ? viewLinking() : `<div class="card">
   ${mode === 'A' ? `<h2>Chapter-wise chanting</h2><p class="muted small">Chant every shloka of a chapter in order. 3 tries each, with helpful hints.</p>
    <label for="rc">1. Select a chapter</label><select id="rc" data-ch="revChapter">${chapterOptions(u.chapter || currentChapter())}</select>
    <label for="rs">Start from</label><select id="rs" data-ch="revStart">${verseOptions(u.chapter || currentChapter(), u.start || 1)}</select>`
    : `<h2>Random shloka revision</h2><p class="muted small">Pick one or more chapters. I'll ask shlokas in a surprise order.</p>
    <label>1. Select chapters</label><div class="chips">${DATA.chapters.map(c => `<button class="chip ${sel.includes(c.n) ? 'on' : ''}" data-a="toggleMulti" data-c="${c.n}" aria-pressed="${sel.includes(c.n)}">${c.n}</button>`).join('')}</div>
    <div class="small muted" style="margin-top:6px">${sel.length ? 'Selected: ' + sel.slice().sort((a, b) => a - b).map(n => 'Ch ' + n).join(' + ') : 'Tap chapter numbers to select.'}</div>
    <label for="rn">How many shlokas?</label><select id="rn" data-ch="revCount">${[5, 10, 15, 20, 30].map(n => `<option ${+(u.count || 10) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label class="check"><input type="checkbox" data-ch="revWeak" ${u.weakFirst ? 'checked' : ''}> Include more of my weak shlokas</label>`}
   <label>2. Select input mode</label>
   <div class="seg"><button class="${input === 'voice' ? 'on' : ''}" data-a="setInput" data-m="voice">🎙️ Voice chanting<small>${Voice.canListen ? 'Chant into the mic' : 'Not supported here'}</small></button><button class="${input === 'text' ? 'on' : ''}" data-a="setInput" data-m="text">⌨️ Text typing<small>Normal English letters are fine</small></button></div>
   ${input === 'voice' ? viewVoiceCheck() : '<p class="small muted" style="margin-top:10px">Type with your normal keyboard, e.g. <i>tatah shankhashcha bheryashcha…</i> Spaces, capitals and small spelling differences are fine.</p>'}
   <div class="sp"></div><button class="btn big" data-a="startRev" ${S.ui.starting ? 'disabled' : ''}>${S.ui.starting ? '<span class="spin"></span> Getting ready…' : '3. Start'}</button>
  </div>`}`;
}
async function ensureMic() {
  if (!Voice.canListen) { S.voice.err = 'unsupported'; return false; }
  S.voice.checking = true; S.voice.err = ''; rerender();
  const r = await Voice.requestMic(); S.voice.checking = false;
  if (r.ok) { S.voice.mic = 'granted'; S.voice.err = ''; } else { S.voice.mic = r.err === 'denied' ? 'denied' : S.voice.mic; S.voice.err = r.err; }
  rerender(); return r.ok;
}
async function startRevision(opts) {
  if (S.ui.starting || S.rev) return;
  const u = S.ui, input = opts.inputType || u.input || 'text';
  let queue = opts.queue, chapters = opts.chapters, mode = opts.mode;
  if (!queue && mode === 'chapter') { const c = +(u.chapter || currentChapter()); chapters = [c]; const st = +(u.start || 1); queue = Array.from({ length: CH(c).count - st + 1 }, (_, i) => ({ c, v: i + st })); }
  if (!queue && mode === 'random') {
    chapters = (u.multi || []).slice().sort((a, b) => a - b); if (!chapters.length) return toast('Please select at least one chapter 🙏');
    const pool = chapters.flatMap(c => Array.from({ length: CH(c).count }, (_, i) => ({ c, v: i + 1 })));
    const n = +(u.count || 10);
    if (u.weakFirst) { const weak = pool.filter(x => (S.progress.get(key(x.c, x.v)) || {}).needs_revision); queue = shuffle(weak).slice(0, Math.ceil(n / 2)); const rest = pool.filter(x => !queue.includes(x)); queue = shuffle(queue.concat(shuffle(rest).slice(0, n - queue.length))); }
    else queue = shuffle(pool).slice(0, n);
  }
  S.ui.starting = true; rerender();
  try {
    if (input === 'voice' && !(await ensureMic())) { toast('🎙️ ' + (VOICE_ERR[S.voice.err] || VOICE_ERR.error)); return; }
    const rev = new Revision({ mode, inputType: input, chapters, queue });
    persistSessionStart(rev);
    S.rev = rev; S.tab = 'revise'; S.sub = 'session'; rev.msg = COACH.welcome; render(); window.scrollTo(0, 0);
    if (input === 'voice') { rev.vstate = 'speaking'; await Voice.speak(COACH.welcome); }
    if (S.rev === rev) askCurrent();
  } finally { S.ui.starting = false; if (!S.rev) rerender(); }
}
async function askCurrent() {
  const rev = S.rev; if (!rev) return;
  rev.state = 'ask'; const p = COACH.prompt(rev);
  rev.msg = (rev.i === 0 ? COACH.welcome + ' ' : '') + p; rev.vstate = rev.inputType === 'voice' ? 'speaking' : 'idle'; render();
  if (rev.inputType === 'voice') { await Voice.speak(p); if (S.rev === rev && rev.vstate === 'speaking') { rev.vstate = 'idle'; rerender(); } }
  else { const t = document.getElementById('ans'); if (t) t.focus({ preventScroll: true }); }
}
async function startListening() {
  const rev = S.rev; if (!rev || rev.listening || rev.busy || rev.vstate === 'connecting' || rev.vstate === 'checking') return;
  if (!Voice.canListen) { rev.vstate = 'error'; rev.verr = 'unsupported'; return rerender(); }
  Voice.stop();
  rev.heard = ''; rev.vstate = 'connecting'; rev.verr = ''; rerender();
  if (navigator.onLine === false) { rev.vstate = 'error'; rev.verr = 'network'; return rerender(); }
  rev.recorder = await Recorder.start();
  const myRev = rev;
  rev.listening = Voice.listen({
    lang: CFG.speechLang || 'hi-IN',
    onStart: () => { if (S.rev !== myRev) return; myRev.vstate = 'listening'; S.voice.mic = 'granted'; rerender(); },
    onText: t => { myRev.heard = t; const el = document.getElementById('heard'); if (el) el.textContent = t || '…'; },
    onFatal: err => { if (S.rev !== myRev) return; myRev.listening = null; if (myRev.recorder) { myRev.recorder.abort(); myRev.recorder = null; } myRev.vstate = 'error'; myRev.verr = err; if (err === 'denied') S.voice.mic = 'denied'; rerender(); }
  });
}
async function stopListening() {
  const rev = S.rev; if (!rev || !rev.listening || rev.busy) return;
  rev.vstate = 'checking'; rerender();
  const res = await rev.listening.stop(); rev.listening = null;
  const blob = rev.recorder ? await rev.recorder.stop() : null; rev.recorder = null;
  if (res.error) { rev.vstate = 'error'; rev.verr = res.error; return rerender(); }
  rev.heard = res.text;
  submitAnswer(res.text, { inputType: 'voice', confidence: res.confidence }, blob);
}
async function submitAnswer(answer, meta, blob) {
  const rev = S.rev; if (!rev || rev.busy) return;
  rev.busy = true;
  try {
    const out = rev.check(answer, meta); rev.lastOut = out;
    if (out.status === 'uncertain') { rev.state = 'ask'; rev.msg = out.hint; rev.vstate = 'idle'; render(); if (rev.inputType === 'voice') { rev.vstate = 'speaking'; await Voice.speak(out.hint); if (S.rev === rev && rev.vstate === 'speaking') { rev.vstate = 'idle'; rerender(); } } return; }
    out.rec.inputType = meta.inputType; out.rec.answer = answer;
    rev.lastAttemptRow = persistAttempt(rev, out.rec, blob);
    if (out.status === 'correct') { rev.state = 'correct'; rev.msg = rev.i + 1 < rev.queue.length ? COACH.correct : COACH.correctLast; persistItemDone(rev, rev.results[rev.results.length - 1]); }
    else if (out.status === 'retry') { rev.state = 'retry'; rev.msg = out.hint; }
    else { rev.state = 'failed'; rev.msg = COACH.failed; persistItemDone(rev, rev.results[rev.results.length - 1]); S.ui.reveal = true; }
    rev.vstate = rev.inputType === 'voice' ? 'speaking' : 'idle';
    render();
    if (rev.inputType === 'voice') { await Voice.speak(rev.msg); if (S.rev === rev && rev.vstate === 'speaking') { rev.vstate = 'idle'; rerender(); } }
    else if (out.status === 'retry') { const t = document.getElementById('ans'); if (t) { t.value = answer; t.focus({ preventScroll: true }); } }
  } finally { rev.busy = false; }
}
async function manualCorrection(text) {
  const rev = S.rev, prev = rev.lastOut; if (!prev || !prev.rec || rev.busy) return;
  rev.undoLast(prev.status); S.ui.reveal = false;
  const row = rev.lastAttemptRow;
  if (row) { S.attempts = S.attempts.filter(a => a.id !== row.id); Sync.run('undo-attempt', () => store.remove('gs_attempts', { id: row.id })); }
  if (prev.status === 'failed') { const k = key(rev.cur.c, rev.cur.v), p = S.progress.get(k); if (p) { p.times_attempted = Math.max(0, p.times_attempted - 1); } }
  submitAnswer(text, { inputType: 'text', manual: true });
}
function coachStateHtml() {
  const rev = S.rev; if (!rev || rev.inputType !== 'voice') return '';
  const vs = Voice.speaking ? 'speaking' : rev.vstate;
  return vs === 'speaking' ? '<span class="spk-dot"></span> Coach is speaking… <button class="linkbtn" style="width:auto;text-decoration:underline" data-a="skipSpeak">skip</button>'
    : vs === 'connecting' ? '<span class="spin sm"></span> Connecting microphone…'
    : vs === 'listening' ? '<span class="rec-dot"></span> Listening – chant now!'
    : vs === 'checking' ? '<span class="spin sm"></span> Checking your chanting…'
    : vs === 'error' ? '⚠️ Microphone problem' : `🎙️ Mic: ${S.voice.mic === 'granted' ? 'ready' : 'tap below to start'}`;
}
function viewSession() {
  const rev = S.rev, v = rev.verse, it = rev.cur, voice = rev.inputType === 'voice', st = rev.state, vs = rev.vstate;
  const dots = [1, 2, 3].map(n => `<i class="${st === 'correct' && n === rev.attempt ? 'ok' : n < rev.attempt || st === 'failed' || (st === 'correct' && n < rev.attempt) ? 'used' : ''}"></i>`).join('');
  const done = st === 'correct' || st === 'failed';
  const lm = rev.mode === 'recall' ? `<div class="banner info">🏛️ Landmark: <b>${esc(it.landmark)}</b></div>` : '';
  const micBtn = vs === 'listening' ? `<button class="mic live" data-a="stopListen">${ICON.mic}<span>I'm done ✓</span></button>`
    : vs === 'connecting' || vs === 'checking' ? `<button class="mic wait" disabled><span class="spin"></span><span>${vs === 'checking' ? 'Checking…' : 'Starting…'}</span></button>`
    : `<button class="mic" data-a="listen">${ICON.mic}<span>Tap & chant</span></button>`;
  return `${header(rev.mode === 'chapter' ? `Chapter ${it.c} · ${CH(it.c).name}` : rev.mode === 'recall' ? 'Landmark recall' : 'Random revision', 'endRev')}
  <div class="row small muted" style="justify-content:space-between;margin-bottom:6px"><span>Shloka ${rev.i + 1} of ${rev.queue.length}</span><span>${voice ? '🎙️ Voice' : '⌨️ Typing'} · <button class="linkbtn" style="width:auto;text-decoration:underline" data-a="switchInput">switch to ${voice ? 'typing' : 'voice'}</button></span></div>
  <div class="bar green" style="margin-bottom:14px"><i style="width:${pct(rev.i, rev.queue.length)}%"></i></div>
  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Chapter ${it.c}, Shloka ${it.v}</h2><div class="attempts" aria-label="Attempt ${rev.attempt} of 3">${dots}</div></div>
   ${lm}<div class="sp"></div>
   <div class="agent">${AV}<div class="bubble" aria-live="polite">${esc(rev.msg)}</div></div>
   ${voice ? `<div class="coachstate" id="coachState">${coachStateHtml()}</div>` : ''}
  </div>
  ${done ? `<div class="card center">${st === 'correct' ? `<div style="font-size:46px">🌟</div><h2>Correct${rev.attempt > 1 ? ` on try ${rev.attempt}` : ' on the first try'}!</h2>${verseText(v)}` : `<div style="font-size:40px">🪷</div><h3>Marked for a little more practice</h3><button class="btn ghost" data-a="reveal">Show the shloka again</button>`}
    <div class="sp"></div><button class="btn big green" data-a="nextQ">${rev.i + 1 < rev.queue.length ? 'Next ➜' : 'Finish session 🎉'}</button></div>`
  : `<div class="card">${voice ? `
    ${vs === 'error' ? `<div class="banner warn" role="alert">${esc(VOICE_ERR[rev.verr] || VOICE_ERR.error)}</div><div class="row"><button class="btn grow" data-a="listen">🔄 Retry</button><button class="btn ghost grow" data-a="switchInput">⌨️ Type instead</button></div>` : micBtn}
    <p class="center small muted">${vs === 'listening' ? 'Chant the full shloka, then tap "I\'m done".' : vs === 'error' ? '' : 'Tap the button and chant the full shloka.'}</p>
    <label>What I heard</label><div class="heard sa" id="heard" style="font-size:18px">${esc(rev.heard) || '…'}</div>
    ${vs !== 'listening' && rev.heard && rev.lastOut && rev.lastOut.rec && !rev.lastOut.r.pass ? `<details ${S.ui.fixOpen ? 'open' : ''}><summary>✏️ I chanted it right – fix what was heard</summary><p class="small muted">If the microphone misheard you, correct the words below (English letters are fine). This replaces your last try, it does not use a new one.</p>
      <form data-f="fix"><textarea name="ans">${esc(rev.heard)}</textarea><button class="btn small green">Check my correction</button></form></details>` : ''}`
  : `<form data-f="answer"><label for="ans">Type the shloka</label><textarea id="ans" name="ans" placeholder="Use normal English letters, e.g. tatah shankhashcha bheryashcha…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
     <div class="sp"></div><button class="btn big" type="submit">Check ✓</button></form>`}
    ${rev.lastOut && rev.lastOut.status === 'retry' ? `<p class="small muted" style="margin-top:8px">Try ${rev.attempt} of 3.</p>` : ''}
  </div>`}
  <div class="center"><button class="btn ghost small" data-a="endRev">End session</button> ${voice ? `<button class="btn ghost small" data-a="mute">${S.ui.mute ? '🔇 Coach voice off' : '🔊 Coach voice on'}</button>` : ''}</div>
  ${S.ui.reveal ? viewReveal() : ''}`;
}
function viewReveal() {
  const rev = S.rev, v = rev.verse, r = rev.lastOut && rev.lastOut.r;
  const bad = new Set(), missing = new Set(), badP = new Set();
  if (r) { r.words.forEach(w => { if (w.status === 'wrong') bad.add(w.index); if (w.status === 'missing') missing.add(w.index); }); r.padas.forEach(p => { if (!p.ok) badP.add(p.idx); }); }
  const list = r ? r.words.filter(w => w.status !== 'ok') : [];
  return `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="Correct shloka">
   <h2>Chapter ${v.c}, Shloka ${v.v}</h2><p class="muted small">Here is the correct shloka. The <span class="pada-bad">highlighted pada</span> is where we'll practise more. ❤️</p>
   <div class="card flat">${verseText(v, { badWords: bad, missing, badPadas: badP })}</div>
   <div class="card flat">${verseText(v, { view: 'iast' })}</div>
   ${list.length ? `<p><b>Where to look:</b></p><ul>${list.slice(0, 6).map(w => `<li>${E.ordinal(w.pada)} pada – <span class="sa" style="font-size:18px">${esc(w.text)}</span> <span class="small muted">(${esc(E.iastToEasy(E.devToIast(w.text)))})</span> ${w.status === 'missing' ? '– missed' : '– needs care'}</li>`).join('')}</ul>` : ''}
   ${r && r.extras.length ? '<p class="small muted">Some extra words were also added.</p>' : ''}
   <p class="small">🔁 Read it slowly, then repeat it aloud once or twice.</p>
   <div class="stackbtns"><button class="btn green big" data-a="closeReveal">✅ I've read and repeated it</button><a class="btn ghost" href="${SOG(v.c, v.v)}" target="_blank" rel="noopener">🎧 Listen on Song of God ↗</a></div>
  </div></div>`;
}
async function finishRevision(early) {
  const rev = S.rev; if (!rev) return;
  if (rev.listening) { rev.listening.abort(); rev.listening = null; }
  if (rev.recorder) { rev.recorder.abort(); rev.recorder = null; }
  Voice.stop();
  const s = rev.summary();
  const chapterComplete = rev.mode === 'chapter' && !early && rev.results.length === rev.queue.length;
  persistSessionTotals(rev, !early || rev.results.length > 0);
  const prev = S.sessions.filter(x => x.id !== rev.sessionId && x.mode === rev.mode && x.total > 0).slice(-5);
  const prevAcc = prev.length ? Math.round(prev.reduce((a, b) => a + (+b.accuracy || 0), 0) / prev.length) : null;
  S.ui.summary = { s, mode: rev.mode, chapters: rev.chapters, chapterComplete, early, prevAcc, results: rev.results.slice(), total: rev.queue.length };
  S.rev = null; S.sub = 'summary'; S.ui.reveal = false; render();
  if (rev.inputType === 'voice' && s.total) Voice.speak(`Well done, champion! You chanted ${s.total} shloka${s.total > 1 ? 's' : ''} with ${s.acc} percent accuracy. Hare Krishna!`);
}
function viewSummary() {
  const { s, mode, chapterComplete, early, prevAcc, results, total, chapters } = S.ui.summary;
  const byCh = {}; results.forEach(r => { (byCh[r.c] = byCh[r.c] || { t: 0, ok: 0 }); byCh[r.c].t++; if (r.correctAt) byCh[r.c].ok++; });
  const target = S.profile.accuracy_target || 99, next = Math.min(target, Math.floor(s.acc / 10) * 10 + 10);
  return `${header('Session complete', 'closeSummary')}
  <div class="card hero center">${LOTUS}<h1>${s.acc >= 90 ? 'Beautiful chanting! 🌟' : s.acc >= 60 ? 'Great effort! 🙌' : 'Well done for practising! ❤️'}</h1>
   <p>${s.total ? (s.acc >= target ? `You reached your ${target}% target. Hare Krishna!` : `You achieved ${s.acc}%. Let's aim for ${next}% in your next revision.`) : 'No shlokas were completed this time – that is okay, try again soon.'}</p></div>
  <div class="card"><div class="row" style="gap:18px">${ring(s.acc, 100, s.acc + '%', '#4E7D4B', 'accuracy')}<div class="grow">
   ${mode === 'chapter' ? `<p><b>Chapter ${chapters[0]}:</b> ${chapterComplete ? '<span class="pill green">Chapter completed 🎉</span>' : `<span class="pill">${early ? 'Paused' : 'In progress'} – ${s.total}/${total}</span>`}</p>` : ''}
   <p class="small muted">Time: <b>${fmtDur(s.secs)}</b>${prevAcc !== null ? ` · Earlier sessions average: <b>${prevAcc}%</b> (${s.acc >= prevAcc ? '+' : ''}${s.acc - prevAcc}%)` : ''}</p></div></div>
   <table><tbody>
    <tr><td>Total ${mode === 'random' ? 'questions' : 'shlokas attempted'}</td><td class="n"><b>${s.total}</b></td></tr>
    <tr><td>Correct on 1st attempt</td><td class="n">${s.c1}</td></tr><tr><td>Correct on 2nd attempt</td><td class="n">${s.c2}</td></tr><tr><td>Correct on 3rd attempt</td><td class="n">${s.c3}</td></tr>
    <tr><td>Correct answers</td><td class="n">${s.total - s.failed}</td></tr><tr><td>Needing revision</td><td class="n">${s.failed}</td></tr>
   </tbody></table></div>
  ${mode !== 'chapter' && Object.keys(byCh).length ? `<div class="card"><h3>Chapter-wise performance</h3>${Object.entries(byCh).map(([c, x]) => barRow('Chapter ' + c, x.ok, x.t, pct(x.ok, x.t) + '%', 'green')).join('')}</div>` : ''}
  ${s.weak.length ? `<div class="card"><h3>Shlokas to practise again</h3><div class="chips">${s.weak.map(w => `<button class="chip" data-a="openVerse" data-c="${w.c}" data-v="${w.v}">${w.c}.${w.v}</button>`).join('')}</div></div>` : ''}
  <button class="btn big" data-a="closeSummary">Back to revision</button><div class="sp"></div><button class="btn big ghost" data-a="go" data-t="progress">See my progress</button>`;
}

// ---------------- MODE C: Shloka linking ----------------
function viewLinking() {
  const L = S.link, c = +L.c, today = todayStr();
  const lms = S.landmarks.filter(l => l.chapter === c).sort((a, b) => a.verse - b.verse);
  const cur = lms.find(l => l.verse === +L.v);
  const linkedToday = S.landmarks.filter(l => l.local_date === today).length;
  return `<div class="card"><h2>Shloka linking</h2><p class="small muted">Connect each shloka to a landmark you can picture – like a walk through a temple. Then remember the shlokas by walking the path.</p>
   <div class="grid2"><div class="stat"><b>${linkedToday}</b><span>linked today</span></div><div class="stat"><b>${S.landmarks.length}</b><span>total linked</span></div></div>
   <label for="lc">Chapter</label><select id="lc" data-ch="linkC">${chapterOptions(c)}</select>
   <label for="lv">Shloka</label><select id="lv" data-ch="linkV">${verseOptions(c, L.v)}</select>
   <div class="card flat" style="margin-top:10px">${verseText(V(c, +L.v))}</div>
   <form data-f="landmark"><label for="lm">Landmark or memory picture</label>
    <div class="row"><input id="lm" name="lm" class="grow" maxlength="200" required value="${esc(cur ? cur.landmark : (S.ui.dictated || ''))}" placeholder="e.g. Temple Gate, Krishna's Chariot">${Voice.canListen ? `<button type="button" class="btn ghost small" data-a="dictate" aria-label="Speak landmark">${S.ui.dictating ? '⏺' : '🎙️'}</button>` : ''}</div>
    <div class="sp"></div><button class="btn big" type="submit">${cur ? 'Update landmark' : 'Save landmark'}</button></form>
   ${cur ? `<div class="row" style="margin-top:8px"><button class="btn ghost small" data-a="delLandmark" data-id="${cur.id}">Delete this landmark</button></div>` : ''}
  </div>
  ${S.ui.askNextLink ? `<div class="card"><div class="agent">${AV}<div class="bubble">Wonderful! Shall we link the next shloka?</div></div><div class="sp"></div>
   <div class="row"><button class="btn green" data-a="linkNext">Yes, next shloka</button><button class="btn ghost" data-a="linkStop">Not now</button></div></div>` : ''}
  <div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Memory chain – Chapter ${c}</h3>${lms.length ? `<button class="btn small peacock" data-a="recall">Practise recall</button>` : ''}</div><div class="sp"></div>
   ${lms.length ? `<div class="chain">${lms.map(l => { const linked = S.links.some(k => k.chapter === c && k.to_verse === l.verse); return `<div class="node"><button class="linkbtn" data-a="pickLink" data-v="${l.verse}"><b>Shloka ${l.verse}</b> → ${esc(l.landmark)} ${linked ? '<span class="pill blue">linked ⛓</span>' : ''}</button></div>`; }).join('')}</div>` : '<p class="muted">No landmarks yet. Start with Shloka 1! 🪷</p>'}</div>`;
}
async function saveLandmark(text) {
  const c = +S.link.c, v = +S.link.v, today = todayStr();
  const ex = S.landmarks.find(l => l.chapter === c && l.verse === v);
  const row = await store.upsert('gs_landmarks', { user_id: S.user.id, chapter: c, verse: v, landmark: text.trim(), local_date: ex ? ex.local_date : today, updated_at: new Date().toISOString() }, 'user_id,chapter,verse');
  S.landmarks = S.landmarks.filter(l => !(l.chapter === c && l.verse === v)).concat([row]);
  const prev = S.landmarks.find(l => l.chapter === c && l.verse === v - 1);
  if (prev && !S.links.some(k => k.chapter === c && k.from_verse === v - 1)) { const lk = await store.upsert('gs_links', { user_id: S.user.id, chapter: c, from_verse: v - 1, to_verse: v, local_date: today }, 'user_id,chapter,from_verse'); S.links.push(lk); }
  S.ui.dictated = ''; S.ui.askNextLink = v < CH(c).count;
  if (S.ui.askNextLink) Voice.speak('Wonderful! Shall we link the next shloka?');
  toast('Landmark saved 🪷'); rerender();
}

// ---------------- PROGRESS + HISTORY ----------------
function badges(st) {
  const sessions = S.sessions.filter(s => s.total > 0), bestAcc = Math.max(0, ...sessions.filter(s => s.total >= 5).map(s => +s.accuracy || 0));
  const list = [
    ['🌱', 'First session', sessions.length >= 1], ['🔥', '3-day streak', st.streak.best >= 3], ['🪔', '7-day streak', st.streak.best >= 7], ['🌟', '21-day streak', st.streak.best >= 21], ['🏵️', '108-day streak', st.streak.best >= 108],
    ['📿', '10 shlokas', st.learned >= 10], ['📿', '50 shlokas', st.learned >= 50], ['📿', '108 shlokas', st.learned >= 108], ['🕉️', 'All shlokas', st.learned >= DATA.total],
    ['🎯', 'Perfect session', sessions.some(s => s.total >= 5 && +s.accuracy === 100)], ['🦚', 'First landmark', S.landmarks.length > 0]
  ];
  DATA.chapters.forEach(c => list.push(['🪷', `Chapter ${c.n}`, st.chaptersDone.includes(c.n)]));
  return { list, bestAcc };
}
function viewProgress() {
  const st = stats(), today = todayStr(), b = badges(st);
  if (!S.attempts.length && !S.landmarks.length && !S.manual) return `${header('Progress')}<div class="card center">${LOTUS}<h2>Your Gita Sadhana journey starts here!</h2><p>Complete your first learning session to see your progress.</p><button class="btn" data-a="go" data-t="revise">Start now</button></div>`;
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(d => { const s = sumItems(items(a => a.local_date === d)); return { l: prettyDate(d, { weekday: 'short' }), v: s.total ? s.acc : null, unit: '%', h: s.acc }; });
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return todayStr(d).slice(0, 7); })
    .map(m => { const s = sumItems(items(a => a.local_date.startsWith(m))); return { l: new Date(m + '-15').toLocaleDateString('en-IN', { month: 'short' }), v: s.total || null, h: 0, n: s.total }; });
  const maxN = Math.max(1, ...months.map(x => x.n)); months.forEach(x => x.h = 100 * x.n / maxN);
  const all = activeDates(), dates = all.slice().reverse(), first = all[0];
  return `${header('Progress')}
  <div class="grid4"><div class="stat"><b>🔥 ${st.streak.cur}</b><span>day streak (best ${st.streak.best})</span></div><div class="stat"><b>${st.all.acc}%</b><span>overall accuracy</span></div><div class="stat"><b>${b.bestAcc}%</b><span>personal best session</span></div><div class="stat"><b>${st.learned}</b><span>shlokas learned</span></div></div><div class="sp"></div>
  <div class="card"><h3>This week (accuracy)</h3>${cols(week)}<h3 style="margin-top:16px">Monthly (shlokas revised)</h3>${cols(months)}</div>
  <div class="card"><h3>Badges & milestones</h3><div class="grid4">${b.list.filter((x, i) => i < 11 || x[2]).map(x => `<div class="badge ${x[2] ? '' : 'off'}"><div class="b">${x[0]}</div>${esc(x[1])}</div>`).join('')}</div>
   <p class="small muted" style="margin-top:10px">Chapter badges 🪷 appear when every shloka of a chapter is learned. This is your personal journey – no rankings, ever. ❤️</p></div>
  <div class="card"><h3>Daily session history</h3><ul class="list">${dates.map(d => { const s = sumItems(items(a => a.local_date === d)); return `<li><button class="link" data-a="openDay" data-d="${d}"><div class="row"><div class="vnum">D${dayDiff(first, d) + 1}</div><div class="grow"><b>Day ${dayDiff(first, d) + 1} – ${esc(prettyDate(d, { day: 'numeric', month: 'long' }))}</b><div class="small muted">${s.total} shlokas · ${s.total ? s.acc + '% accuracy' : 'linking only'}</div></div><span>›</span></div></button></li>`; }).join('')}</ul></div>`;
}
function viewDay(d) {
  const first = activeDates()[0] || d, its = items(a => a.local_date === d), s = sumItems(its);
  const ses = S.sessions.filter(x => x.local_date === d), secs = ses.reduce((a, b) => a + (b.duration_sec || 0), 0);
  const chs = [...new Set(its.map(i => i.c))].sort((a, b) => a - b);
  const mistakes = S.attempts.filter(a => a.local_date === d && a.result === 'incorrect');
  const corrected = [...new Set(its.filter(i => i.correctAt > 1).map(i => key(i.c, i.v)))];
  const linked = S.landmarks.filter(l => l.local_date === d);
  const prevDates = activeDates().filter(x => x < d && items(a => a.local_date === x).length); const pd = prevDates[prevDates.length - 1];
  const ps = pd ? sumItems(items(a => a.local_date === pd)) : null;
  const modeName = { chapter: 'Chapter-wise', random: 'Random revision', recall: 'Landmark recall' };
  return `${header(`Day ${dayDiff(first, d) + 1} – ${prettyDate(d, { day: 'numeric', month: 'long' })}`, 'closeDay')}
  <div class="grid4"><div class="stat"><b>${s.acc}%</b><span>accuracy</span></div><div class="stat"><b>${fmtDur(secs)}</b><span>time spent</span></div><div class="stat"><b>${new Set(its.map(i => key(i.c, i.v))).size}</b><span>shlokas chanted</span></div><div class="stat"><b>${linked.length}</b><span>shlokas linked</span></div></div><div class="sp"></div>
  ${ps ? `<div class="banner ${s.acc >= ps.acc ? 'ok' : 'info'}">${s.acc >= ps.acc ? '📈' : '🌱'} Compared with ${prettyDate(pd, { day: 'numeric', month: 'short' })}: ${ps.acc}% → ${s.acc}% (${s.acc - ps.acc >= 0 ? '+' : ''}${s.acc - ps.acc}%)</div>` : ''}
  <div class="card"><h3>Chapters practised</h3><p>${chs.length ? chs.map(c => `Chapter ${c} – ${esc(CH(c).name)}`).join('<br>') : '—'}</p>
   <h3>Shlokas chanted</h3><div class="chips">${its.map(i => `<button class="chip ${i.correctAt ? '' : 'on'}" data-a="openVerse" data-c="${i.c}" data-v="${i.v}">${i.c}.${i.v} ${i.correctAt === 1 ? '✓' : i.correctAt ? '✓' + i.correctAt : '↺'}</button>`).join('') || '—'}</div>
   <p class="small muted">✓ first try · ✓2/✓3 correct on 2nd/3rd try · ↺ needs revision</p></div>
  <div class="card"><h3>Mistakes made (${mistakes.length})</h3>${mistakes.length ? `<ul class="list">${mistakes.slice(0, 40).map(m => `<li><div><b>${m.chapter}.${m.verse}</b> · try ${m.attempt_no}<div class="small">${(m.mistakes || []).slice(0, 4).map(x => x.type === 'added' ? 'extra words added' : `pada ${x.pada}: <span class="sa" style="font-size:16px">${esc(x.word)}</span> ${x.type === 'missing' ? '(missed)' : ''}`).join(' · ') || 'small differences'}</div></div></li>`).join('')}</ul>${mistakes.length > 40 ? `<p class="small muted">…and ${mistakes.length - 40} more</p>` : ''}` : '<p>No mistakes – wonderful! 🌟</p>'}
   <h3>Mistakes corrected</h3><p>${corrected.length ? corrected.join(', ') + ' – you fixed these on a later try! 💪' : '—'}</p></div>
  ${linked.length ? `<div class="card"><h3>Shlokas linked</h3><p>${linked.map(l => `${l.chapter}.${l.verse} → ${esc(l.landmark)}`).join('<br>')}</p></div>` : ''}
  <div class="card"><h3>Sessions on this day</h3>${ses.length ? `<ul class="list">${ses.map(x => `<li><div class="grow"><b>${esc(modeName[x.mode] || x.mode)}</b> · ${x.input_type === 'voice' ? '🎙️' : '⌨️'} · ${timeOf(x.started_at)}<div class="small muted">Chapter ${(x.chapters || []).join(', ')} · ${x.total} shlokas${x.total ? ' · ' + Math.round(+x.accuracy || 0) + '%' : ''}</div></div><button class="btn small ghost" data-a="delSession" data-id="${x.id}" aria-label="Delete this session">🗑 Delete</button></li>`).join('')}</ul>` : '<p class="muted">No revision sessions.</p>'}</div>`;
}

// ---------------- TOOLS ----------------
function viewTools() {
  const t = [['level', '📝', 'Your Level', 'Your 15-day learning check'], ['score', '🏆', 'Your Scoreboard', 'Accuracy, strong & weak shlokas'], ['library', '📚', 'Shloka Library', 'All 18 chapters · Song of God numbering'], ['meanings', '💡', 'Meanings of Shlokas', 'Simple meanings & stories for kids'], ['check', '🌳', 'Check Your Progress', 'Chapters & shlokas completed']];
  return `${header('Tools')}${t.map(x => `<button class="card linkbtn" data-a="tool" data-t="${x[0]}"><div class="row"><div style="font-size:34px">${x[1]}</div><div class="grow"><h3 style="margin:0">${x[2]}</h3><div class="small muted">${x[3]}</div></div><span>›</span></div></button>`).join('')}`;
}
function autoLevel() {
  const st = stats(), today = todayStr();
  const firstCorrect = new Map(); S.attempts.forEach(a => { if (a.result !== 'incorrect') { const k = key(a.chapter, a.verse); if (!firstCorrect.has(k)) firstCorrect.set(k, a.local_date); } });
  return { current_chapter: currentChapter(), shlokas_completed: st.learned, learned_today: [...firstCorrect.values()].filter(d => d === today).length, shlokas_remaining: DATA.total - st.learned };
}
function viewLevel() {
  const a = autoLevel(), hist = S.assessments.slice().reverse(), last = S.assessments[S.assessments.length - 1];
  const due = !last || dayDiff(last.created_at.slice(0, 10), todayStr()) >= 15;
  return `${header('Your Level', 'go')}
  <div class="banner ${due ? 'warn' : 'ok'}">${due ? '📝 Your 15-day level check is due today.' : `✅ Next check on ${prettyDate(addDays(last.created_at.slice(0, 10), 15), { day: 'numeric', month: 'long' })}.`}</div>
  <div class="card"><p class="small muted">I've filled this in from your app activity. You can correct anything.</p><form data-f="level">
   <label for="l1">Which chapter are you currently learning?</label><select id="l1" name="current_chapter">${chapterOptions(a.current_chapter)}</select>
   <label for="l2">How many shlokas have you completed?</label><input id="l2" name="shlokas_completed" type="number" min="0" max="${DATA.total}" value="${a.shlokas_completed}">
   <label for="l3">How many shlokas did you learn today?</label><input id="l3" name="learned_today" type="number" min="0" max="${DATA.total}" value="${a.learned_today}">
   <label for="l4">How many shlokas are remaining?</label><input id="l4" name="shlokas_remaining" type="number" min="0" max="${DATA.total}" value="${a.shlokas_remaining}">
   <label for="l5">What is your current learning goal?</label><input id="l5" name="goal" maxlength="200" value="${esc(last ? last.goal : '')}" placeholder="e.g. Finish Chapter 12 by Gita Jayanti">
   <div class="sp"></div><button class="btn big">Save my level</button></form></div>
  ${hist.length ? `<div class="card"><h3>Previous checks</h3><table class="stack"><thead><tr><th>Date</th><th>Chapter</th><th class="n">Completed</th><th class="n">Change</th></tr></thead><tbody>${hist.map((h, i) => { const prev = hist[i + 1]; const ch = prev ? h.shlokas_completed - prev.shlokas_completed : null; return `<tr><td>${prettyDate(h.created_at.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>${h.current_chapter}</td><td class="n">${h.shlokas_completed}</td><td class="n">${ch === null ? '—' : (ch >= 0 ? '+' : '') + ch}</td></tr>`; }).join('')}</tbody></table></div>` : ''}`;
}
function viewScore() {
  const st = stats(), all = st.all, rnd = sumItems(items(a => (S.sessions.find(s => s.id === a.session_id) || {}).mode === 'random'));
  const target = S.profile.accuracy_target || 99, acc = all.acc, next = Math.min(target, Math.floor(acc / 10) * 10 + 10);
  const perCh = DATA.chapters.map(c => ({ c: c.n, ...sumItems(items(a => a.chapter === c.n)) })).filter(x => x.total);
  const perV = new Map(); items().forEach(i => { const k = key(i.c, i.v); const x = perV.get(k) || { c: i.c, v: i.v, t: 0, ok: 0, first: 0 }; x.t++; if (i.correctAt) x.ok++; if (i.correctAt === 1) x.first++; perV.set(k, x); });
  const weak = [...perV.values()].filter(x => x.ok / x.t < 0.6 || (S.progress.get(key(x.c, x.v)) || {}).needs_revision).sort((a, b) => a.ok / a.t - b.ok / b.t).slice(0, 15);
  const strong = [...perV.values()].filter(x => x.first >= 2 && x.ok === x.t).slice(0, 15);
  const today = todayStr();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(d => { const s = sumItems(items(a => a.local_date === d)); return { l: prettyDate(d, { weekday: 'short' }), v: s.total ? s.acc : null, unit: '%', h: s.acc }; });
  const weeks = Array.from({ length: 4 }, (_, i) => { const end = addDays(today, -7 * (3 - i)), start = addDays(end, -6); const s = sumItems(items(a => a.local_date >= start && a.local_date <= end)); return { l: prettyDate(start, { day: 'numeric', month: 'short' }), v: s.total ? s.acc : null, unit: '%', h: s.acc }; });
  if (!all.total) return `${header('Your Scoreboard', 'go')}<div class="card center">${LOTUS}<h2>No scores yet</h2><p>Complete a revision session and your scoreboard will appear here. 😊</p><button class="btn" data-a="go" data-t="revise">Start revision</button></div>`;
  return `${header('Your Scoreboard', 'go')}
  <div class="card hero"><div class="row" style="gap:16px">${ring(acc, 100, acc + '%', '#EE8A2E', 'accuracy')}<div class="grow"><h2>${acc >= target ? `Target reached! 🎉` : `Great effort! You achieved ${acc}%.`}</h2><p>${acc >= target ? 'Keep chanting with love. Hare Krishna!' : `Let's aim for ${next}% in your next revision. 🌟`}</p></div></div>
   <form data-f="target" class="row"><label for="tg" style="margin:0">My target</label><input id="tg" name="t" type="range" min="50" max="100" value="${target}" class="grow" data-ch="targetLive"><b id="tgv">${target}%</b><button class="btn small ghost">Save</button></form>
   ${barRow('Progress', acc, target, `${acc}/${target}`)}</div>
  <div class="grid4"><div class="stat"><b>${rnd.total ? rnd.acc + '%' : '—'}</b><span>random revision accuracy</span></div><div class="stat"><b>${all.total}</b><span>total shlokas revised</span></div><div class="stat"><b>${all.correct}</b><span>correct answers</span></div><div class="stat"><b>${all.failed}</b><span>incorrect (needing revision)</span></div>
   <div class="stat"><b>${all.firstAcc}%</b><span>first-attempt success</span></div><div class="stat"><b>${all.acc}%</b><span>three-attempt success</span></div><div class="stat"><b>🔥 ${st.streak.cur}</b><span>daily streak</span></div><div class="stat"><b>${st.memorised}</b><span>strongly memorised</span></div></div><div class="sp"></div>
  <div class="card"><h3>Chapter-wise accuracy</h3>${perCh.map(x => barRow('Chapter ' + x.c, x.acc, 100, x.acc + '%', 'green')).join('')}</div>
  <div class="card"><h3>Weekly performance</h3>${cols(week)}<h3 style="margin-top:14px">Monthly performance (by week)</h3>${cols(weeks)}</div>
  <div class="card"><h3>🌱 Shlokas to strengthen</h3><div class="chips">${weak.map(x => `<button class="chip" data-a="openVerse" data-c="${x.c}" data-v="${x.v}">${x.c}.${x.v}</button>`).join('') || '<span class="muted">None right now 🌟</span>'}</div>
   ${weak.length ? `<div class="sp"></div><button class="btn small peacock" data-a="quickWeak">Revise these now</button>` : ''}
   <h3 style="margin-top:14px">💪 Strong shlokas</h3><div class="chips">${strong.map(x => `<span class="chip">${x.c}.${x.v}</span>`).join('') || '<span class="muted">Chant a shloka right on the first try twice to see it here.</span>'}</div></div>`;
}
function sogCard(c, v) {
  return `<div class="card layer"><h3>3 · Word meanings &nbsp;4 · Translation &nbsp;5 · Commentary</h3>
   <p class="small">Read Swami Mukundananda Ji's word-by-word meanings, English translation and detailed commentary – and listen to the shloka audio – in <b>Bhagavad Gita: The Song of God</b> (JKYog).</p>
   <div class="row"><a class="btn peacock" href="${SOG(c, v)}" target="_blank" rel="noopener">Open ${c}.${v} in Song of God ↗</a><a class="btn ghost small" href="${SOG_APP}" target="_blank" rel="noopener">Song of God app ↗</a></div>
   <p class="small muted">Gita Sadhana links to the official source and does not copy its commentary or audio.</p></div>`;
}
function viewLibrary() {
  const L = S.lib;
  if (L.v) {
    const v = V(L.c, L.v), p = S.progress.get(key(L.c, L.v)) || {}, lm = S.landmarks.find(l => l.chapter === L.c && l.verse === L.v);
    return `${header(`Chapter ${L.c} · Shloka ${L.v}`, 'libBack')}
    <div class="tabs"><button class="chip ${L.view === 'both' ? 'on' : ''}" data-a="libView" data-m="both">Both</button><button class="chip ${L.view === 'dev' ? 'on' : ''}" data-a="libView" data-m="dev">देवनागरी</button><button class="chip ${L.view === 'iast' ? 'on' : ''}" data-a="libView" data-m="iast">Roman</button></div>
    ${L.view !== 'iast' ? `<div class="card layer"><h3>1 · Original Sanskrit</h3>${verseText(v)}</div>` : ''}
    ${L.view !== 'dev' ? `<div class="card layer"><h3>${L.view === 'both' ? '2' : '2'} · Roman transliteration</h3>${verseText(v, { view: 'iast' })}</div>` : ''}
    ${sogCard(L.c, L.v)}
    <div class="card layer kids"><h3>🧒 Gita Sadhana kids' explanation</h3><p class="small">Simple meanings, stories and difficult words – written with AI for children, kept separate from the official commentary.</p><button class="btn small" data-a="explore" data-c="${L.c}" data-v="${L.v}">💡 Open kids' explanation</button></div>
    ${lm ? `<p><span class="pill blue">🏛️ My landmark: ${esc(lm.landmark)}</span></p>` : ''}
    <div class="row"><button class="btn ${p.bookmarked ? 'peacock' : 'ghost'}" data-a="bookmark">${p.bookmarked ? '🔖 Bookmarked' : '🔖 Bookmark'}</button><button class="btn ${p.learned ? 'green' : 'ghost'}" data-a="markLearned">${p.learned ? '✅ Learned' : 'Mark as learned'}</button></div><div class="sp"></div>
    <div class="row"><button class="btn ghost small" data-a="libStep" data-d="-1" ${L.v <= 1 ? 'disabled' : ''}>← Previous</button><button class="btn ghost small" data-a="practiseOne" data-c="${L.c}" data-v="${L.v}">📿 Chant this</button><button class="btn ghost small" data-a="libStep" data-d="1" ${L.v >= CH(L.c).count ? 'disabled' : ''}>Next →</button></div>
    <p class="src">Sanskrit: ${esc(DATA.source)}</p>`;
  }
  const q = (L.q || '').trim();
  let results = null;
  if (q) {
    const m = q.match(/^(\d{1,2})\s*[.:,\s]\s*(\d{1,2})$/);
    if (m && V(+m[1], +m[2])) results = [V(+m[1], +m[2])];
    else { const kq = E.toKey(q); if (!DATA.keys) DATA.keys = new Map(DATA.shlokas.map(s => [key(s.c, s.v), E.toKey(s.lines.join(' '))])); results = kq.length >= 3 ? DATA.shlokas.filter(s => DATA.keys.get(key(s.c, s.v)).includes(kq)).slice(0, 40) : []; }
  }
  const bms = [...S.progress.values()].filter(p => p.bookmarked);
  const li = s => { const p = S.progress.get(key(s.c, s.v)) || {}; return `<li><button class="link" data-a="libOpen" data-c="${s.c}" data-v="${s.v}"><div class="row"><div class="vnum ${p.learned ? 'learned' : ''}">${!results ? s.v : s.c + '.' + s.v}</div><div class="grow"><div class="sa" style="font-size:17px;line-height:1.6">${esc(s.lines[0])}</div><div class="small muted">${esc(E.iastToEasy(E.devToIast(s.lines[0])))}</div></div>${p.bookmarked ? '🔖' : ''}</div></button></li>`; };
  return `${header(L.c ? `Chapter ${L.c} · ${CH(L.c).name}` : 'Shloka Library', L.c ? 'libChapters' : 'go')}
  <form data-f="libSearch" class="row"><input name="q" class="grow" value="${esc(L.q)}" placeholder="Search: 2.47 or karmanye…" aria-label="Search shlokas"><button class="btn small">Search</button></form><div class="sp"></div>
  ${results ? `<div class="card"><h3>${results.length} result${results.length === 1 ? '' : 's'}</h3><ul class="list">${results.map(li).join('')}</ul><button class="btn ghost small" data-a="libClear">Clear search</button></div>` : L.c ? `<div class="card"><p class="muted small">${CH(L.c).count} shlokas · green = learned · <a href="https://www.holy-bhagavad-gita.org/chapter/${L.c}/" target="_blank" rel="noopener">Chapter ${L.c} in Song of God ↗</a></p><ul class="list">${DATA.shlokas.filter(s => s.c === L.c).map(li).join('')}</ul></div>`
  : `${bms.length ? `<div class="card"><h3>🔖 Bookmarks</h3><div class="chips">${bms.map(p => `<button class="chip" data-a="libOpen" data-c="${p.chapter}" data-v="${p.verse}">${p.chapter}.${p.verse}</button>`).join('')}</div></div>` : ''}
   <ul class="list card">${DATA.chapters.map(c => { const n = Array.from({ length: c.count }, (_, i) => (S.progress.get(key(c.n, i + 1)) || {}).learned).filter(Boolean).length; return `<li><button class="link" data-a="libChapter" data-c="${c.n}"><div class="row"><div class="vnum ${n === c.count ? 'learned' : ''}">${c.n}</div><div class="grow"><b>${esc(c.name)}</b><div class="small muted"><span class="sa" style="font-size:15px">${esc(c.sa || '')}</span> · ${c.count} shlokas · ${n} learned</div></div><span>›</span></div></button></li>`; }).join('')}</ul>
   <p class="small muted">${esc(DATA.notes || '')} Each shloka links to the official Song of God page for word meanings, translation, commentary and audio.</p>`}`;
}
function viewMeanings() {
  const M = S.mean, v = V(M.c, M.v), r = M.res;
  return `${header('Meanings of Shlokas', 'go')}
  <div class="card"><h2>Which chapter would you like to explore today?</h2>
   <label for="mc">Chapter</label><select id="mc" data-ch="meanC">${chapterOptions(M.c)}</select>
   <label for="mv">Shloka</label><select id="mv" data-ch="meanV">${verseOptions(M.c, M.v)}</select>
   <div class="sp"></div><button class="btn big" data-a="doExplore">Explore 🔍</button></div>
  ${M.shown ? `<div class="card layer"><h3>The shloka – Chapter ${M.c}, Shloka ${M.v}</h3>${verseText(v)}${verseText(v, { view: 'iast' })}</div>
   ${sogCard(M.c, M.v)}
   ${M.loading ? '<div class="card center"><p><span class="spin"></span> Preparing a simple explanation… 🪷</p></div>' : r && r.error ? `<div class="card"><div class="banner warn">${esc(r.error)}</div><p class="small muted">The shloka and the Song of God link above are always available.</p></div>` : r ? `
   <div class="kidsbox"><div class="pill">🧒 Gita Sadhana kids' explanation · AI-written · not official commentary</div>
   ${[['1. Simple Meaning', r.simple_meaning], ['2. Real Meaning', r.real_meaning], ['3. Meaning for Kids', r.kids_meaning], ['4. Commentary for Kids', r.kids_commentary]].map(x => `<div class="card"><h3>${x[0]}</h3><p>${esc(x[1]).replace(/\n/g, '<br>')}</p></div>`).join('')}
   ${(r.difficult_words || []).length ? `<div class="card"><h3>Difficult Sanskrit words</h3><ul class="list">${r.difficult_words.map(w => `<li><div><b class="sa" style="font-size:18px">${esc(w.word)}</b> <span class="small muted">${esc(E.iastToEasy(E.devToIast(w.word)))}</span> – ${esc(w.meaning)}</div></li>`).join('')}</ul></div>` : ''}
   <p class="src">Source: ${esc(r.source)}</p></div>` : ''}` : ''}`;
}
async function doExplore() {
  const M = S.mean; M.shown = true; M.loading = true; M.res = null; rerender();
  try {
    const rows = await store.list('gs_meanings', { chapter: +M.c, verse: +M.v });
    if (rows[0]) M.res = rows[0];
    else { const data = await store.invoke(CFG.explainFunction || 'explain-shloka', { chapter: +M.c, verse: +M.v }); M.res = data; }
  } catch (e) { M.res = { error: /not configured|ANTHROPIC|Failed to send|404|not found/i.test(e.message) ? 'Kids\' explanations for this shloka are not ready yet. Chapter 12 is ready now – more chapters are coming soon! 🪷' : 'Could not load the explanation: ' + friendlyErr(e) }; }
  M.loading = false; rerender();
}
function viewCheck() {
  const st = stats(), m = S.manual || { chapters_completed: [], chapters_learning: [], shlokas_learned: 0, shlokas_memorised: 0 };
  const empty = !S.attempts.length && !S.manual;
  const appL = appLearnedSet();
  const perCh = DATA.chapters.map(c => { let n = 0; for (let v = 1; v <= c.count; v++) if (st.L.has(key(c.n, v))) n++; return { c: c.n, n, t: c.count }; });
  const sel = S.ui.checkSel || { done: m.chapters_completed.slice(), learning: m.chapters_learning.slice() };
  S.ui.checkSel = sel;
  const overall = pct(st.learned, DATA.total);
  return `${header('Check Your Progress', 'go')}
  ${empty ? `<div class="card center">${LOTUS}<h2>Your Gita Sadhana journey starts here!</h2><p>Complete your first learning session to see your progress.</p></div>` : `
  <div class="card"><div class="row" style="justify-content:space-around;gap:12px">${ring(st.chaptersDone.length, 18, `${st.chaptersDone.length}/18`, '#4E7D4B', 'chapters')}${ring(st.learned, DATA.total, st.learned, '#EE8A2E', `of ${DATA.total} shlokas`)}${ring(overall, 100, overall + '%', '#1F6F78', 'complete')}</div>
   <table style="margin-top:10px"><tbody><tr><td>Chapters completed</td><td class="n"><b>${st.chaptersDone.length}</b> / 18</td></tr><tr><td>Chapters remaining</td><td class="n">${18 - st.chaptersDone.length}</td></tr>
   <tr><td>Shlokas learned</td><td class="n"><b>${st.learned}</b> / ${DATA.total}</td></tr><tr><td>Shlokas remaining</td><td class="n">${DATA.total - st.learned}</td></tr><tr><td>Strongly memorised</td><td class="n">${st.memorised}</td></tr>
   <tr><td>Overall completion</td><td class="n"><b>${overall}%</b></td></tr></tbody></table>
   <p class="small muted">App records: ${appL.size} learned. Your entries are combined with app records without counting any shloka twice.</p></div>
  <div class="card"><h3>Chapter-wise progress</h3>${perCh.map(x => barRow('Chapter ' + x.c, x.n, x.t, `${x.n}/${x.t}`, x.n === x.t ? 'green' : '')).join('')}</div>`}
  <div class="card"><h3>Update my progress</h3><p class="small muted">Update daily or monthly – for shlokas you learned with your teacher or book outside the app.</p>
   <label>How many Bhagavad Gita chapters have you completed?</label><div class="chips">${DATA.chapters.map(c => `<button class="chip ${sel.done.includes(c.n) ? 'on' : ''}" data-a="chkDone" data-c="${c.n}" aria-pressed="${sel.done.includes(c.n)}">${c.n}</button>`).join('')}</div>
   <label>Chapters I am currently learning</label><div class="chips">${DATA.chapters.map(c => `<button class="chip ${sel.learning.includes(c.n) ? 'on' : ''}" data-a="chkLearning" data-c="${c.n}">${c.n}</button>`).join('')}</div>
   <form data-f="check"><div class="grid2"><div><label for="c1">Total shlokas learned</label><input id="c1" name="learned" type="number" min="0" max="${DATA.total}" value="${Math.max(m.shlokas_learned, st.learned)}"></div>
    <div><label for="c2">Total shlokas memorised</label><input id="c2" name="memorised" type="number" min="0" max="${DATA.total}" value="${Math.max(m.shlokas_memorised, st.memorised)}"></div></div>
    <p class="small muted">Shlokas still remaining will be calculated: ${DATA.total} − learned.</p><button class="btn big">Save my progress</button></form>
   ${S.manual ? `<p class="small muted">Last updated ${prettyDate(S.manual.updated_at.slice(0, 10), { day: 'numeric', month: 'long' })}</p>` : ''}</div>`;
}

// ---------------- PROFILE ----------------
function viewProfile() {
  const p = S.profile, r = S.reminders || {}, last = S.callLogs[S.callLogs.length - 1], today = todayStr();
  const notif = 'Notification' in window ? Notification.permission : 'unsupported';
  const todaySessions = S.sessions.filter(s => s.local_date === today).length;
  return `${header('Profile', 'goHome')}
  <div class="card"><h3>👤 ${esc(p.display_name)}</h3><p class="small muted">${esc(S.user.email || '')} · ${store.kind === 'cloud' ? 'saved securely in the cloud' : 'test mode'}</p>
   <form data-f="profile"><label for="pn">Name</label><input id="pn" name="name" maxlength="40" value="${esc(p.display_name)}">
    <div class="grid2"><div><label for="pg">Daily goal (shlokas)</label><input id="pg" name="goal" type="number" min="1" max="100" value="${p.daily_goal}"></div><div><label for="pt">Accuracy target %</label><input id="pt" name="target" type="number" min="10" max="100" value="${p.accuracy_target}"></div></div>
    ${store.kind === 'cloud' ? `<label class="check"><input type="checkbox" name="rec" ${p.save_recordings ? 'checked' : ''}> Save my voice recordings (private – only I can hear them). Off by default.</label>` : ''}
    <button class="btn">Save</button></form></div>
  <div class="card"><h3>🔔 Daily reminder</h3>
   <form data-f="reminder"><label for="rt">In-app reminder time (India time)</label><input id="rt" name="time" type="time" value="${esc((r.call_time || '09:00').slice(0, 5))}">
    <label class="check"><input type="checkbox" name="inapp" ${r.in_app_enabled !== false ? 'checked' : ''}> Show an in-app reminder if I haven't practised by this time</label>
    <h3 style="margin-top:16px">📞 Daily AI voice call (Bolna)</h3>
    <p class="small muted">A cheerful AI coach calls every day at about <b>9:00 AM India time</b>: "Hare Krishna! It's time for your Bhagavad Gita Sadhana. Shall we revise today's shlokas?" No call if you have already practised that day.</p>
    <label for="rp">Phone number (with country code)</label><input id="rp" name="phone" type="tel" placeholder="+91XXXXXXXXXX" value="${esc(r.phone_e164 || '')}">
    <label class="check"><input type="checkbox" name="consent" ${r.consent_at ? 'checked' : ''}> I am the parent/guardian and I agree that Gita Sadhana may call this number once a day using Bolna AI. I can turn this off at any time.</label>
    <label class="check"><input type="checkbox" name="call" ${r.call_enabled ? 'checked' : ''}> Turn on the daily call</label>
    <div class="grid2"><div><label for="rr">If missed, call again</label><select id="rr" name="retry">${[0, 1, 2, 3].map(n => `<option value="${n}" ${+r.retry_count === n ? 'selected' : ''}>${n ? n + ' more time' + (n > 1 ? 's' : '') : "Don't retry"}</option>`).join('')}</select></div>
     <div><label for="rg">Wait between calls</label><select id="rg" name="gap">${[10, 15, 30, 60].map(n => `<option value="${n}" ${+r.retry_gap_min === n ? 'selected' : ''}>${n} minutes</option>`).join('')}</select></div></div>
    <div class="sp"></div><button class="btn">Save reminder settings</button></form>
   <div class="banner info" style="margin-top:12px">${r.call_enabled && r.consent_at && r.phone_e164 ? `📞 Daily call is on for ${esc(r.phone_e164)} at about 9:00 AM.` : '📞 Daily call is off. The in-app reminder works without it.'}${last ? ` Last call: ${esc(last.local_date)} – ${esc(last.status)}${last.outcome ? ' (' + esc(last.outcome) + ')' : ''}.` : ''}</div>
   <div class="row"><button class="btn ghost small" data-a="notif" ${notif === 'granted' || notif === 'unsupported' ? 'disabled' : ''}>${notif === 'granted' ? '✅ Notifications allowed' : notif === 'unsupported' ? 'Notifications not supported' : 'Allow notifications on this phone'}</button></div></div>
  <div class="card"><h3>🧹 My learning records</h3><p class="small muted">Remove test practice safely. Your account, goals and the shloka library are never deleted here. Nothing resets automatically.</p>
   <div class="stackbtns">
    <button class="btn ghost" data-a="delToday" ${todaySessions ? '' : 'disabled'}>🗑 Delete today's test session${todaySessions > 1 ? 's' : ''} (${todaySessions})</button>
    <button class="btn ghost" data-a="resetToday">↺ Reset today's progress</button>
    <button class="btn ghost" data-a="go" data-t="progress">📅 Delete one session (open a day in History)</button>
    <button class="btn danger" data-a="resetAll">⚠️ Reset all learning progress</button></div></div>
  ${store.kind === 'cloud' ? `<div class="card"><h3>🎙️ My recordings (${S.recordings.length})</h3>${S.recordings.length ? `<ul class="list">${S.recordings.slice(-20).reverse().map(x => { const a = S.attempts.find(t => t.id === x.attempt_id); return `<li><div class="grow small">${a ? `${a.chapter}.${a.verse} · try ${a.attempt_no} · ${a.local_date}` : x.created_at.slice(0, 10)}</div><button class="btn small ghost" data-a="playRec" data-id="${x.id}">▶</button><button class="btn small ghost" data-a="delRec" data-id="${x.id}">🗑</button></li>`; }).join('')}</ul><button class="btn small danger" data-a="delAllRec">Delete all recordings</button>` : '<p class="small muted">No recordings saved.</p>'}</div>` : ''}
  <div class="card"><h3>Account</h3><p class="small muted">You stay signed in on this device. On another device, sign in with the same email to see all your progress.</p>
   <div class="row"><button class="btn ghost" data-a="signOut">Sign out</button><button class="btn ghost small" data-a="delAcc">Delete my whole account…</button></div></div>
  <p class="center small muted">Gita Sadhana · made with ❤️ for one shloka a day</p>`;
}

// ---------------- deletions (always confirmed, always scoped) ----------------
async function rebuildAndReload(msg) {
  try { await store.rpc('gs_rebuild_progress'); } catch (e) { console.warn('rebuild', e); }
  await loadUser(); toast(msg); render();
}
async function removeRecordingsFor(attemptIds) {
  const set = new Set(attemptIds), recs = S.recordings.filter(r => set.has(r.attempt_id));
  if (!recs.length) return;
  await store.removeFiles(recs.map(r => r.storage_path)).catch(() => {});
  for (const r of recs) await store.remove('gs_recordings', { id: r.id });
}
const DEL = {
  async today() {
    await Sync.drain(); const today = todayStr();
    await removeRecordingsFor(S.attempts.filter(a => a.local_date === today).map(a => a.id));
    await store.remove('gs_sessions', { user_id: S.user.id, local_date: today });
    await rebuildAndReload("Today's test session deleted ✅");
  },
  async resetToday() {
    await Sync.drain(); const today = todayStr();
    await removeRecordingsFor(S.attempts.filter(a => a.local_date === today).map(a => a.id));
    await store.remove('gs_sessions', { user_id: S.user.id, local_date: today });
    await store.remove('gs_links', { user_id: S.user.id, local_date: today });
    await store.remove('gs_landmarks', { user_id: S.user.id, local_date: today });
    await rebuildAndReload("Today's progress has been reset ✅");
  },
  async session(id) {
    await Sync.drain();
    await removeRecordingsFor(S.attempts.filter(a => a.session_id === id).map(a => a.id));
    await store.remove('gs_sessions', { id, user_id: S.user.id });
    await rebuildAndReload('Session deleted ✅');
  },
  async all() {
    await Sync.drain(); const u = S.user.id;
    await removeRecordingsFor(S.attempts.map(a => a.id));
    await store.remove('gs_sessions', { user_id: u });
    for (const t of ['gs_links', 'gs_landmarks', 'gs_level_assessments', 'gs_manual_progress']) await store.remove(t, { user_id: u });
    await store.update('gs_shloka_progress', { user_id: u }, { learned: false, learned_source: null });
    await rebuildAndReload('All learning progress has been reset. A fresh start! 🌱');
  }
};

// ---------------- render & routing ----------------
const TABS = [['home', 'Home'], ['revise', 'Revision'], ['course', 'My Course'], ['progress', 'Progress'], ['tools', 'Tools']];
function render() {
  if (!S.user) { $nav.classList.add('hide'); $app.innerHTML = viewAuth(); return; }
  $nav.classList.remove('hide');
  $nav.innerHTML = TABS.map(t => `<a href="#${t[0]}" class="${S.tab === t[0] ? 'on' : ''}" data-a="go" data-t="${t[0]}" aria-label="${t[1]}" ${S.tab === t[0] ? 'aria-current="page"' : ''}>${ICON[t[0]]}<span>${t[1]}</span></a>`).join('');
  let html;
  if (S.tab === 'revise') html = S.sub === 'session' && S.rev ? viewSession() : S.sub === 'summary' && S.ui.summary ? viewSummary() : viewReviseSetup();
  else if (S.tab === 'course') html = viewCourse();
  else if (S.tab === 'tools') html = ({ level: viewLevel, score: viewScore, library: viewLibrary, meanings: viewMeanings, check: viewCheck }[S.sub] || viewTools)();
  else if (S.tab === 'progress') html = S.sub && S.sub.startsWith('day:') ? viewDay(S.sub.slice(4)) : viewProgress();
  else if (S.tab === 'profile') html = viewProfile();
  else html = viewHome();
  if (S.ui.confirm) html += viewConfirm();
  const y = window.scrollY, keep = S.ui.keepScroll;
  $app.innerHTML = html; if (keep) window.scrollTo(0, y); S.ui.keepScroll = false;
  paintCloud();
}
const rerender = () => { S.ui.keepScroll = true; render(); };
function go(tab, sub = null) {
  if (S.rev && !(tab === 'revise' && S.sub === 'session')) finishRevision(true);
  S.tab = tab; S.sub = sub; S.ui.confirm = null; if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab); render(); window.scrollTo(0, 0);
}
async function saveProgressRow(c, v, patch) {
  const k = key(c, v), base = Object.assign({ user_id: S.user.id, chapter: c, verse: v, learned: false, bookmarked: false, needs_revision: false, times_attempted: 0, times_correct: 0, first_try_correct: 0 }, S.progress.get(k) || {}, patch, { updated_at: new Date().toISOString() });
  delete base.id; delete base.created_at;
  const r = await store.upsert('gs_shloka_progress', base, 'user_id,chapter,verse'); S.progress.set(k, r || base);
}
async function sendCode(email, name) {
  S.ui.authBusy = true; S.ui.authMsg = ''; S.ui.authErr = false; render();
  try {
    await store.sendOtp(email, name);
    S.ui.otpEmail = email; S.ui.lastEmail = email; S.ui.pendingName = name; S.ui.authMsg = store.kind === 'local' ? 'Test mode: use code 123456.' : 'Code sent! It can take a minute – check Spam too.';
  } catch (e) {
    S.ui.authErr = true;
    S.ui.authMsg = /rate limit|too many|seconds/i.test(e.message) ? 'Too many codes were requested. Please wait a few minutes, then try again. 🙏' : /invalid.*email|email address/i.test(e.message) ? 'Please check the email address.' : 'Could not send the code: ' + friendlyErr(e);
  } finally { S.ui.authBusy = false; render(); }
}

const ACT = {
  go: el => go(el.dataset.t || 'tools'),
  goHome: () => go('home'),
  tool: el => go('tools', el.dataset.t),
  syncRetry: async () => { S.ui.syncWarned = false; await Sync.flush(); if (!Sync.q.length) { try { await store.ping(); } catch (e) {} } rerender(); toast(Sync.q.length ? '⚠️ Still not saved – check your internet.' : '☁️ Everything is saved.'); },
  otpBack: () => { S.ui.otpEmail = ''; S.ui.authMsg = ''; render(); },
  otpResend: () => sendCode(S.ui.otpEmail, S.ui.pendingName || ''),
  setMode: el => { S.ui.mode = el.dataset.m; rerender(); },
  setInput: async el => { S.ui.input = el.dataset.m; rerender(); if (el.dataset.m === 'voice' && Voice.canListen) { const st = await Voice.micState(); if (st !== 'unknown') { S.voice.mic = st; rerender(); } } },
  micCheck: () => ensureMic(),
  voiceTest: () => Voice.speak("Hare Krishna, champion! I'm your Gita chanting coach. Let's chant together!"),
  toggleMulti: el => { const c = +el.dataset.c, m = S.ui.multi = S.ui.multi || []; const i = m.indexOf(c); i >= 0 ? m.splice(i, 1) : m.push(c); rerender(); },
  startRev: () => startRevision({ mode: (S.ui.mode || 'A') === 'A' ? 'chapter' : 'random' }),
  quickWeak: () => { const weak = [...S.progress.values()].filter(p => p.needs_revision).map(p => ({ c: p.chapter, v: p.verse })); if (!weak.length) return toast('No weak shlokas right now 🌟'); S.tab = 'revise'; startRevision({ mode: 'random', inputType: S.ui.input || 'text', chapters: [...new Set(weak.map(w => w.c))].sort((a, b) => a - b), queue: shuffle(weak).slice(0, 15) }); },
  practiseOne: el => { const c = +el.dataset.c, v = +el.dataset.v; S.tab = 'revise'; startRevision({ mode: 'random', inputType: S.ui.input || 'text', chapters: [c], queue: [{ c, v }] }); },
  listen: () => startListening(), stopListen: () => stopListening(),
  skipSpeak: () => { Voice.stop(); if (S.rev && S.rev.vstate === 'speaking') { S.rev.vstate = 'idle'; } rerender(); },
  switchInput: async () => {
    const rev = S.rev; if (!rev || rev.busy) return;
    if (rev.listening) { rev.listening.abort(); rev.listening = null; }
    Voice.stop();
    if (rev.inputType === 'text') { if (!(await ensureMic())) { toast('🎙️ ' + (VOICE_ERR[S.voice.err] || VOICE_ERR.error)); return; } rev.inputType = 'voice'; }
    else rev.inputType = 'text';
    rev.vstate = 'idle'; rev.verr = ''; render();
  },
  nextQ: async () => { const rev = S.rev; if (!rev || rev.busy) return; S.ui.reveal = false; S.ui.fixOpen = false; Voice.stop(); if (rev.next()) { rev.msg = ''; askCurrent(); } else finishRevision(false); },
  reveal: () => { S.ui.reveal = true; rerender(); }, closeReveal: () => { S.ui.reveal = false; rerender(); },
  endRev: () => finishRevision(true),
  closeSummary: () => { S.sub = null; S.ui.summary = null; render(); },
  mute: () => { S.ui.mute = !S.ui.mute; if (S.ui.mute) Voice.stop(); rerender(); },
  dictate: async () => {
    if (S.ui.dictating) return; S.ui.dictating = true; rerender();
    const l = Voice.listen({ lang: 'en-IN', onText: t => { const i = document.getElementById('lm'); if (i) i.value = t; }, onFatal: err => toast('🎙️ ' + (VOICE_ERR[err] || VOICE_ERR.error)) });
    setTimeout(async () => { const r = await l.stop(); S.ui.dictating = false; if (r.text) S.ui.dictated = r.text; rerender(); const i = document.getElementById('lm'); if (i && r.text) i.value = r.text; }, 5000);
  },
  pickLink: el => { S.link.v = +el.dataset.v; S.ui.askNextLink = false; rerender(); },
  linkNext: () => { S.link.v = Math.min(CH(S.link.c).count, +S.link.v + 1); S.ui.askNextLink = false; render(); const i = document.getElementById('lm'); if (i) i.focus(); },
  linkStop: () => { S.ui.askNextLink = false; rerender(); },
  delLandmark: el => confirmBox('Delete this landmark?', 'Are you sure you want to delete this landmark? This action cannot be undone.', 'Delete', async () => {
    const l = S.landmarks.find(x => x.id === el.dataset.id); if (!l) return;
    await store.remove('gs_landmarks', { id: l.id }); await store.remove('gs_links', { user_id: S.user.id, chapter: l.chapter, to_verse: l.verse }); await store.remove('gs_links', { user_id: S.user.id, chapter: l.chapter, from_verse: l.verse });
    S.landmarks = S.landmarks.filter(x => x.id !== l.id); S.links = S.links.filter(k => !(k.chapter === l.chapter && (k.to_verse === l.verse || k.from_verse === l.verse))); toast('Landmark deleted');
  }),
  recall: () => { const c = +S.link.c; const q = S.landmarks.filter(l => l.chapter === c).sort((a, b) => a.verse - b.verse).map(l => ({ c, v: l.verse, landmark: l.landmark })); startRevision({ mode: 'recall', inputType: S.ui.input || 'text', chapters: [c], queue: q }); },
  openDay: el => { S.sub = 'day:' + el.dataset.d; render(); window.scrollTo(0, 0); }, closeDay: () => { S.sub = null; render(); },
  openVerse: el => { S.lib = { c: +el.dataset.c, v: +el.dataset.v, q: '', view: 'both' }; go('tools', 'library'); },
  libChapter: el => { S.lib.c = +el.dataset.c; S.lib.v = null; render(); window.scrollTo(0, 0); }, libChapters: () => { S.lib.c = null; S.lib.q = ''; render(); },
  libOpen: el => { S.lib.c = +el.dataset.c; S.lib.v = +el.dataset.v; render(); window.scrollTo(0, 0); }, libBack: () => { S.lib.v = null; render(); },
  libView: el => { S.lib.view = el.dataset.m; rerender(); }, libStep: el => { S.lib.v += +el.dataset.d; render(); }, libClear: () => { S.lib.q = ''; render(); },
  bookmark: async () => { const p = S.progress.get(key(S.lib.c, S.lib.v)) || {}; await saveProgressRow(S.lib.c, S.lib.v, { bookmarked: !p.bookmarked }); rerender(); },
  markLearned: async () => { const p = S.progress.get(key(S.lib.c, S.lib.v)) || {}; await saveProgressRow(S.lib.c, S.lib.v, p.learned ? { learned: false, learned_source: null } : { learned: true, learned_source: 'manual' }); toast(p.learned ? 'Unmarked' : 'Marked as learned ✅'); rerender(); },
  explore: el => { S.mean = { c: +el.dataset.c, v: +el.dataset.v }; go('tools', 'meanings'); doExplore(); },
  doExplore: () => doExplore(),
  chkDone: el => { const c = +el.dataset.c, a = S.ui.checkSel.done, i = a.indexOf(c); i >= 0 ? a.splice(i, 1) : a.push(c); rerender(); },
  chkLearning: el => { const c = +el.dataset.c, a = S.ui.checkSel.learning, i = a.indexOf(c); i >= 0 ? a.splice(i, 1) : a.push(c); rerender(); },
  editGoal: el => { S.ui.editGoal = el.dataset.id; rerender(); const i = document.getElementById('gt'); if (i) i.focus(); }, cancelGoal: () => { S.ui.editGoal = null; rerender(); },
  delGoal: el => { const g = S.goals.find(x => x.id === el.dataset.id); if (!g) return; confirmBox('Delete this goal?', `Are you sure you want to delete the goal "${g.title}"? This action cannot be undone.`, 'Delete goal', async () => { await store.remove('gs_goals', { id: g.id }); S.goals = S.goals.filter(x => x.id !== g.id); if (S.ui.editGoal === g.id) S.ui.editGoal = null; toast('Goal deleted'); }); },
  delToday: () => confirmBox("Delete today's test session?", "Are you sure you want to delete today's test progress? This action cannot be undone. Sessions from other days stay safe.", "Yes, delete today's sessions", () => DEL.today()),
  resetToday: () => confirmBox("Reset today's progress?", "This deletes today's revision sessions and the landmarks you made today. This action cannot be undone. Other days stay safe.", "Yes, reset today", () => DEL.resetToday()),
  delSession: el => { const s = S.sessions.find(x => x.id === el.dataset.id); confirmBox('Delete this session?', `Are you sure you want to delete this ${s ? s.total + '-shloka ' : ''}session from ${s ? prettyDate(s.local_date, { day: 'numeric', month: 'long' }) : 'this day'}? This action cannot be undone. Other sessions stay safe.`, 'Delete session', () => DEL.session(el.dataset.id)); },
  resetAll: () => confirmBox('Reset ALL learning progress?', 'This removes every revision session, score, learned mark, landmark, level check and progress entry. Your account, goals, settings and the shloka library stay. This action cannot be undone.', 'Yes, reset everything', () => DEL.all()),
  confirmNo: () => { S.ui.confirm = null; rerender(); },
  confirmYes: async el => { const c = S.ui.confirm; if (!c || S.ui.confirmBusy) return; S.ui.confirmBusy = true; el.disabled = true; el.innerHTML = '<span class="spin sm"></span> Working…';
    try { await c.fn(); S.ui.confirm = null; } catch (e) { toast('Could not finish: ' + friendlyErr(e)); S.ui.confirm = null; } finally { S.ui.confirmBusy = false; rerender(); } },
  notif: async () => { try { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Notifications allowed 🔔' : 'Notifications not allowed'); scheduleReminder(); rerender(); } catch (e) { toast('Notifications are not available here'); } },
  playRec: async el => { const r = S.recordings.find(x => x.id === el.dataset.id); try { const url = await store.fileUrl(r.storage_path); new Audio(url).play(); } catch (e) { toast('Could not play: ' + friendlyErr(e)); } },
  delRec: el => confirmBox('Delete this recording?', 'Are you sure? This action cannot be undone.', 'Delete', async () => { const r = S.recordings.find(x => x.id === el.dataset.id); await store.removeFiles([r.storage_path]).catch(() => {}); await store.remove('gs_recordings', { id: r.id }); S.recordings = S.recordings.filter(x => x.id !== r.id); toast('Recording deleted'); }),
  delAllRec: () => confirmBox('Delete all recordings?', 'Are you sure you want to delete all your voice recordings? This action cannot be undone.', 'Delete all', async () => { await store.removeFiles(S.recordings.map(r => r.storage_path)).catch(() => {}); await store.remove('gs_recordings', { user_id: S.user.id }); S.recordings = []; toast('All recordings deleted'); }),
  signOut: () => confirmBox('Sign out?', 'You can sign in again any time with your email code. Your progress stays safe in the cloud.', 'Sign out', async () => { if (Sync.q.length) await Sync.drain(); await store.signOut(); S.user = null; S.ui = {}; }, false),
  delAcc: () => confirmBox('Delete your whole account?', 'This permanently deletes your account, all progress, goals, landmarks and recordings. This action cannot be undone.', 'Delete my account', async () => { await store.deleteAccount(); S.user = null; S.ui = { authMsg: 'Your account and all data have been deleted.' }; })
};
const CHANGE = {
  revChapter: el => { S.ui.chapter = +el.value; S.ui.start = 1; rerender(); }, revStart: el => { S.ui.start = +el.value; },
  revCount: el => { S.ui.count = +el.value; }, revWeak: el => { S.ui.weakFirst = el.checked; },
  linkC: el => { S.link.c = +el.value; S.link.v = 1; S.ui.askNextLink = false; rerender(); }, linkV: el => { S.link.v = +el.value; S.ui.askNextLink = false; rerender(); },
  meanC: el => { S.mean.c = +el.value; S.mean.v = 1; S.mean.shown = false; rerender(); }, meanV: el => { S.mean.v = +el.value; S.mean.shown = false; },
  targetLive: el => { const b = document.getElementById('tgv'); if (b) b.textContent = el.value + '%'; },
  courseChapter: async el => { const c = +el.value; try { await store.update('gs_profiles', { id: S.user.id }, { current_chapter: c }); S.profile.current_chapter = c; S.ui.chapter = c; toast(`Now learning Chapter ${c} 📖`); } catch (e) { toast('Could not save: ' + friendlyErr(e)); } rerender(); },
  goalDone: async el => { const g = S.goals.find(x => x.id === el.dataset.id); if (!g) return; try { await store.update('gs_goals', { id: g.id }, { done: el.checked, updated_at: new Date().toISOString() }); g.done = el.checked; if (el.checked) toast('Goal achieved! 🎉 Hare Krishna!'); } catch (e) { el.checked = !el.checked; toast('Could not save: ' + friendlyErr(e)); } rerender(); }
};
const FORMS = {
  otpSend: f => { const d = Object.fromEntries(new FormData(f)); const email = String(d.email || '').trim().toLowerCase(); if (!email) return; S.ui.pendingName = String(d.name || '').trim(); sendCode(email, S.ui.pendingName); },
  otpVerify: async f => {
    const code = String(new FormData(f).get('code') || '').replace(/\D/g, ''); if (code.length < 6) { S.ui.authErr = true; S.ui.authMsg = 'Please enter the code from the email.'; return render(); }
    S.ui.authBusy = true; S.ui.authMsg = ''; render();
    try { await store.verifyOtp(S.ui.otpEmail, code); S.ui.otpEmail = ''; await boot(); }
    catch (e) { S.ui.authErr = true; S.ui.authMsg = /expired|invalid/i.test(e.message) ? "That code didn't work or has expired. Please check the newest email, or send a new code." : 'Could not sign in: ' + friendlyErr(e); }
    finally { S.ui.authBusy = false; if (!S.user) render(); }
  },
  goal: async f => { const g = Math.max(1, Math.min(100, +new FormData(f).get('goal') || 5)); await store.update('gs_profiles', { id: S.user.id }, { daily_goal: g }); S.profile.daily_goal = g; toast('Daily goal saved 🎯'); rerender(); },
  targets: async f => { const d = new FormData(f), daily = Math.max(1, Math.min(100, +d.get('daily') || 5)), monthly = Math.max(1, Math.min(2000, +d.get('monthly') || 60)); await store.update('gs_profiles', { id: S.user.id }, { daily_goal: daily, monthly_goal: monthly }); S.profile.daily_goal = daily; S.profile.monthly_goal = monthly; toast('Targets saved 🎯'); rerender(); },
  goalSave: async f => {
    const d = new FormData(f), title = String(d.get('title') || '').trim(); if (!title) return;
    const row = { title, chapter: d.get('chapter') ? +d.get('chapter') : null, due_date: d.get('due') || null, updated_at: new Date().toISOString() };
    if (S.ui.editGoal) { await store.update('gs_goals', { id: S.ui.editGoal }, row); Object.assign(S.goals.find(g => g.id === S.ui.editGoal), row); S.ui.editGoal = null; toast('Goal updated ✏️'); }
    else { const r = await store.insert('gs_goals', Object.assign({ user_id: S.user.id, done: false }, row)); S.goals.push(r); toast('Goal added 🌟'); }
    rerender();
  },
  answer: f => { const a = String(new FormData(f).get('ans') || ''); if (!a.trim()) return toast('Please type the shloka first 🙏'); submitAnswer(a, { inputType: 'text' }); },
  fix: f => { const a = String(new FormData(f).get('ans') || ''); if (a.trim()) manualCorrection(a); },
  landmark: f => { const t = String(new FormData(f).get('lm') || '').trim(); if (t) saveLandmark(t).catch(e => toast('Could not save: ' + friendlyErr(e))); },
  libSearch: f => { S.lib.q = String(new FormData(f).get('q') || ''); render(); },
  level: async f => {
    const d = Object.fromEntries(new FormData(f)); const row = { user_id: S.user.id, current_chapter: +d.current_chapter, shlokas_completed: +d.shlokas_completed, learned_today: +d.learned_today, shlokas_remaining: +d.shlokas_remaining, goal: d.goal, auto_values: autoLevel() };
    const r = await store.insert('gs_level_assessments', row); S.assessments.push(r); toast('Level saved 📝 See you in 15 days!'); render();
  },
  target: async f => { const t = +new FormData(f).get('t'); await store.update('gs_profiles', { id: S.user.id }, { accuracy_target: t }); S.profile.accuracy_target = t; toast('Target saved 🎯'); rerender(); },
  check: async f => {
    const d = new FormData(f), sel = S.ui.checkSel;
    const row = { user_id: S.user.id, chapters_completed: sel.done.slice().sort((a, b) => a - b), chapters_learning: sel.learning.slice().sort((a, b) => a - b), shlokas_learned: Math.min(DATA.total, +d.get('learned') || 0), shlokas_memorised: Math.min(DATA.total, +d.get('memorised') || 0), updated_at: new Date().toISOString() };
    S.manual = await store.upsert('gs_manual_progress', row, 'user_id'); toast('Progress saved 🌳'); render(); window.scrollTo(0, 0);
  },
  profile: async f => { const d = new FormData(f); const patch = { display_name: String(d.get('name') || '').trim() || S.profile.display_name, daily_goal: Math.max(1, Math.min(100, +d.get('goal') || 5)), accuracy_target: Math.max(10, Math.min(100, +d.get('target') || 99)) }; if (store.kind === 'cloud') patch.save_recordings = !!d.get('rec'); await store.update('gs_profiles', { id: S.user.id }, patch); Object.assign(S.profile, patch); toast('Saved ✅'); rerender(); },
  reminder: async f => {
    const d = new FormData(f), phone = String(d.get('phone') || '').replace(/[\s-]/g, ''), consent = !!d.get('consent'), call = !!d.get('call');
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) return toast('Please enter the number with country code, e.g. +91…');
    if (call && (!phone || !consent)) return toast('To turn on the call, add a phone number and tick the consent box 🙏');
    const patch = { user_id: S.user.id, call_time: String(d.get('time') || '09:00'), in_app_enabled: !!d.get('inapp'), phone_e164: phone || null, consent_at: consent ? (S.reminders.consent_at || new Date().toISOString()) : null, call_enabled: call && consent && !!phone, retry_count: +d.get('retry'), retry_gap_min: +d.get('gap'), timezone: TZ, updated_at: new Date().toISOString() };
    S.reminders = await store.upsert('gs_reminders', patch, 'user_id') || patch; scheduleReminder(); toast('Reminder settings saved 🔔'); rerender();
  }
};
const busy = new WeakSet();
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return; const f = ACT[el.dataset.a]; if (!f) return; e.preventDefault();
  if (busy.has(el)) return; busy.add(el); setTimeout(() => busy.delete(el), 400); // stops accidental double taps
  Promise.resolve(f(el)).catch(err => { console.error(err); toast('Could not finish: ' + friendlyErr(err)); });
});
document.addEventListener('submit', e => { const f = e.target; if (!f.dataset.f) return; e.preventDefault(); if (f.dataset.busy) return; f.dataset.busy = '1'; Promise.resolve(FORMS[f.dataset.f](f)).catch(err => { console.error(err); toast('Could not save: ' + friendlyErr(err)); }).finally(() => { delete f.dataset.busy; }); });
document.addEventListener('change', e => { const el = e.target; if (el.dataset.ch && CHANGE[el.dataset.ch]) CHANGE[el.dataset.ch](el); });
document.addEventListener('input', e => { if (e.target.dataset.ch === 'targetLive') CHANGE.targetLive(e.target); });
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (S.user && ['home', 'revise', 'course', 'tools', 'progress', 'profile'].includes(t) && t !== S.tab) go(t); });

function scheduleReminder() {
  clearTimeout(S.remTimer); const r = S.reminders; if (!r || !r.in_app_enabled) return;
  const [hh, mm] = (r.call_time || '09:00').split(':').map(Number), now = nowTimeIST().split(':').map(Number);
  const ms = ((hh * 60 + mm) - (now[0] * 60 + now[1])) * 60000; if (ms <= 0) return;
  S.remTimer = setTimeout(() => { if (streaks().practisedToday) return; try { if (Notification.permission === 'granted') new Notification('Gita Sadhana 🪷', { body: "Hare Krishna! It's time for your Bhagavad Gita Sadhana. Shall we revise today's shlokas?", icon: 'icon.svg' }); } catch (e) {} if (S.tab === 'home') render(); }, ms);
}

async function boot() {
  try {
    if (!DATA.shlokas.length) await loadData();
    S.user = await store.user();
    if (S.user) {
      $app.innerHTML = `<div class="center" style="padding-top:30vh"><p><span class="spin"></span> Loading your progress from the cloud…</p></div>`;
      await loadUser(); const t = location.hash.slice(1).split('&')[0];
      S.tab = ['home', 'revise', 'course', 'tools', 'progress', 'profile'].includes(t) ? t : 'home'; scheduleReminder();
      if (/access_token|type=magiclink|type=signup/.test(location.hash)) history.replaceState(null, '', location.pathname + '#home');
    }
    render();
  } catch (e) {
    console.error(e);
    $app.innerHTML = `<div class="card" style="margin-top:20vh"><h2>Could not connect</h2><p>${esc(friendlyErr(e))}</p><p class="small muted">Your progress is safe in the cloud. Check your internet connection and try again.</p><button class="btn" onclick="location.reload()">🔄 Try again</button></div>`;
  }
}
if (store.kind === 'cloud') store.sb.auth.onAuthStateChange((ev) => {
  if (ev === 'SIGNED_OUT' && S.user) { S.user = null; render(); }
  if (ev === 'SIGNED_IN' && !S.user && !S.ui.authBusy) setTimeout(boot, 0); // magic link opened in this tab
});
if (Voice.canSpeak) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch (e) {} }
window.GS = { S, DATA, store: () => store, Revision, Sync, Voice };
boot();
})();
