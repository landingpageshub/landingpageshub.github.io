/* Gita Sadhana – Shloka comparison engine (deterministic, reference-based).
   Works in the browser (window.GSEngine) and in Node (module.exports).
   Same engine is used by voice mode, text mode, landmark recall and any future voice agent. */
(function (root) {
  'use strict';
  // ---------- Devanagari -> IAST ----------
  const V = { 'अ':'a','आ':'ā','इ':'i','ई':'ī','उ':'u','ऊ':'ū','ऋ':'ṛ','ॠ':'ṝ','ऌ':'ḷ','ए':'e','ऐ':'ai','ओ':'o','औ':'au' };
  const M = { 'ा':'ā','ि':'i','ी':'ī','ु':'u','ू':'ū','ृ':'ṛ','ॄ':'ṝ','ॢ':'ḷ','े':'e','ै':'ai','ो':'o','ौ':'au','ॅ':'e','ॉ':'o' };
  const C = { 'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ṅ','च':'c','छ':'ch','ज':'j','झ':'jh','ञ':'ñ','ट':'ṭ','ठ':'ṭh','ड':'ḍ','ढ':'ḍh','ण':'ṇ',
    'त':'t','थ':'th','द':'d','ध':'dh','न':'n','प':'p','फ':'ph','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'ś','ष':'ṣ','स':'s','ह':'h','ळ':'ḷ',
    'क़':'k','ख़':'kh','ग़':'g','ज़':'j','ड़':'ḍ','ढ़':'ḍh','फ़':'ph','य़':'y' };
  const isDev = s => /[ऀ-ॿ]/.test(s);
  function devToIast(s) {
    s = (s || '').normalize('NFC');
    let out = '', i = 0;
    while (i < s.length) {
      let ch = s[i];
      if (s[i + 1] === '़' && C[ch + '़']) { ch = ch + '़'; i++; }
      if (C[ch]) {
        out += C[ch]; const n = s[i + 1];
        if (n === '़') { i++; }
        const nn = s[i + 1];
        if (nn === '्') { i += 2; continue; }
        if (M[nn]) { out += M[nn]; i += 2; continue; }
        out += 'a'; i++; continue;
      }
      if (V[ch]) out += V[ch];
      else if (ch === 'ं') out += 'ṃ';
      else if (ch === 'ँ') out += 'ṃ';
      else if (ch === 'ः') out += 'ḥ';
      else if (ch === 'ऽ') out += '’';
      else if (ch === 'ॐ') out += 'oṃ';
      else if (M[ch] || ch === '्' || ch === '़') { /* stray mark */ }
      else if (ch === '।' || ch === '॥') out += ' ';
      else out += ch;
      i++;
    }
    return out;
  }
  // Easy-to-read style used by many kids' Gita books (śh, ṣh, ch, chh, ṛi, ṁ)
  function iastToEasy(s) {
    return s.replace(/ch/g, '\u0001').replace(/c/g, 'ch').replace(/\u0001/g, 'chh')
      .replace(/ś/g, 'śh').replace(/ṣ/g, 'ṣh').replace(/ṛ/g, 'ṛi').replace(/ṝ/g, 'ṝi').replace(/ṃ/g, 'ṁ');
  }
  // ---------- Any script -> loose phonetic key ----------
  const VOW = 'aeiou';
  function toKey(input) {
    const parts = (input || '').normalize('NFC').split(/[\s\-–—|।॥,.;:!?'"’‘“”()\[\]0-9]+/).filter(Boolean);
    return parts.map(keyWord).join('');
  }
  function keyWord(input) {
    let s = input;
    if (isDev(s)) s = devToIast(s);
    s = s.toLowerCase()
      .replace(/[ṛṝ]i?/g, 'ri').replace(/ḷ/g, 'li').replace(/[ṃṁ]/g, 'm').replace(/[ṅñṇ]/g, 'n')
      .replace(/[śṣ]h?/g, 'sh').replace(/ḥ/g, 'h')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z]/g, '');
    s = s.replace(/x/g, 'ks').replace(/w/g, 'v').replace(/f/g, 'ph').replace(/z/g, 'j').replace(/q/g, 'k')
      .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/aa/g, 'a')
      .replace(/chh|cch/g, 'c').replace(/ch/g, 'c').replace(/sh/g, 's')
      .replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/jh/g, 'j').replace(/th/g, 't').replace(/dh/g, 'd').replace(/ph/g, 'p').replace(/bh/g, 'b')
      .replace(/jny|jn|gy(?=[aeiou])|dny/g, 'jn')
      .replace(/ri(?=[aeiou])/g, 'r');
    // visarga / weak h: drop h after a vowel when not followed by a vowel
    let t = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === 'h' && i > 0 && VOW.includes(s[i - 1]) && !(i + 1 < s.length && VOW.includes(s[i + 1]))) continue;
      t += c;
    }
    // nasal before consonant -> n ; m/n variants (anusvara, sandhi) are treated the same
    t = t.replace(/m(?=[^aeiouy])/g, 'n');
    // collapse doubled letters (gemination is often unclear in speech)
    t = t.replace(/(.)\1+/g, '$1');
    return t;
  }
  // ---------- Reference model ----------
  function buildReference(verse) {
    const chars = []; // {ch, pada, word, optional}
    const words = [];
    if (verse.spk) for (const ch of toKey(verse.spk)) chars.push({ ch, pada: -1, word: -1, optional: true });
    verse.padas.forEach((p, pi) => {
      p.split(/\s+/).filter(Boolean).forEach(w => {
        const k = toKey(w); if (!k) return;
        const wi = words.length; words.push({ text: w, pada: pi, key: k, start: chars.length });
        for (const ch of k) chars.push({ ch, pada: pi, word: wi, optional: false });
        words[wi].end = chars.length;
      });
    });
    return { chars, words, padaCount: verse.padas.length };
  }
  const SIM = ['ie', 'uo', 'vb', 'nm', 'td', 'kg', 'pb', 'sc', 'yi', 'vu', 'ln', 'rl'];
  const subCost = (a, b) => a === b ? 0 : (SIM.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a)) ? 0.5 : 1);
  function align(ref, inp) {
    const n = ref.length, m = inp.length, EDGE_INS = 0.4;
    const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
    const B = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 1 diag,2 del(ref),3 ins(inp)
    for (let j = 1; j <= m; j++) { D[0][j] = D[0][j - 1] + EDGE_INS; B[0][j] = 3; }
    for (let i = 1; i <= n; i++) {
      D[i][0] = D[i - 1][0] + (ref[i - 1].optional ? 0 : 1); B[i][0] = 2;
      for (let j = 1; j <= m; j++) {
        const ins = (i === n ? EDGE_INS : 1);
        let best = D[i - 1][j - 1] + subCost(ref[i - 1].ch, inp[j - 1]), b = 1;
        const del = D[i - 1][j] + (ref[i - 1].optional ? 0 : 1); if (del < best) { best = del; b = 2; }
        const insC = D[i][j - 1] + ins; if (insC < best) { best = insC; b = 3; }
        D[i][j] = best; B[i][j] = b;
      }
    }
    // backtrace -> per ref char op + insertions attached to ref index
    const ops = new Array(n).fill('m'), insAt = new Array(n + 1).fill(0), insText = new Array(n + 1).fill('');
    let i = n, j = m;
    while (i > 0 || j > 0) {
      const b = B[i][j];
      if (b === 1) { ops[i - 1] = ref[i - 1].ch === inp[j - 1] ? 'm' : (subCost(ref[i - 1].ch, inp[j - 1]) < 1 ? 'n' : 's'); i--; j--; }
      else if (b === 2) { ops[i - 1] = 'd'; i--; }
      else { insAt[i]++; insText[i] = inp[j - 1] + insText[i]; j--; }
    }
    return { ops, insAt, insText };
  }
  const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
  /** Compare an answer with a verse.
   *  opts: { inputType: 'voice'|'text', asrConfidence: 0..1 } */
  function compare(verse, answer, opts = {}) {
    const voice = opts.inputType === 'voice';
    const R = buildReference(verse);
    const inp = toKey(answer);
    const req = R.chars.filter(c => !c.optional).length;
    const base = { inputKey: inp, refLength: req };
    if (inp.length < 3) return Object.assign(base, { pass: false, uncertain: true, reason: voice ? 'no-speech' : 'empty', score: 0, padas: [], words: [], extras: [] });
    const { ops, insAt, insText } = align(R.chars, inp);
    const wErr = (o) => o === 's' || o === 'd' ? 1 : o === 'n' ? 0.5 : 0;
    const padas = Array.from({ length: R.padaCount }, (_, k) => ({ idx: k, err: 0, len: 0 }));
    let total = 0;
    R.chars.forEach((c, k) => { if (c.optional) return; const e = wErr(ops[k]) + (k > 0 && k < R.chars.length ? Math.min(insAt[k], 6) : 0); padas[c.pada].err += e; padas[c.pada].len++; total += e; });
    const extras = [];
    for (let k = 0; k <= R.chars.length; k++) if (insAt[k] >= 4) extras.push({ afterWord: k > 0 ? R.chars[k - 1].word : -1, text: insText[k] });
    const tolWord = voice ? 0.45 : 0.3;
    const words = R.words.map((w, wi) => {
      let e = 0, d = 0; for (let k = w.start; k < w.end; k++) { e += wErr(ops[k]); if (ops[k] === 'd') d++; }
      for (let k = w.start + 1; k < w.end; k++) e += insAt[k];
      const len = w.end - w.start, ratio = e / len;
      const status = d >= Math.max(2, 0.7 * len) ? 'missing' : ratio > tolWord ? 'wrong' : 'ok';
      return { index: wi, pada: w.pada, text: w.text, status, ratio: +ratio.toFixed(2) };
    });
    padas.forEach(p => { p.score = p.len ? Math.max(0, 1 - p.err / p.len) : 1; p.wrongWords = words.filter(w => w.pada === p.idx && w.status !== 'ok').length; p.ok = p.wrongWords === 0 && p.score >= (voice ? 0.55 : 0.7); });
    const score = Math.max(0, 1 - total / Math.max(1, req));
    const big = extras.filter(x => x.text.length >= (voice ? 8 : 5));
    const pass = score >= (voice ? 0.8 : 0.9) && padas.every(p => p.ok) && big.length === 0;
    const conf = typeof opts.asrConfidence === 'number' && opts.asrConfidence > 0 ? opts.asrConfidence : null;
    let uncertain = false, reason = '';
    if (!pass && voice) {
      if (inp.length < 0.35 * req) { uncertain = true; reason = 'too-short'; }
      else if (conf !== null && conf < 0.5 && score >= 0.55) { uncertain = true; reason = 'low-confidence'; }
    }
    return Object.assign(base, { pass, uncertain, reason, score: +score.toFixed(3), confidence: conf, padas: padas.map(p => ({ idx: p.idx, score: +p.score.toFixed(2), ok: p.ok, wrongWords: p.wrongWords })), words, extras: big });
  }
  const ordinal = i => ORD[i] || (i + 1) + 'th';
  function listPadas(idxs) { const n = idxs.map(i => ordinal(i)); return n.length === 1 ? 'the ' + n[0] + ' pada' : 'the ' + n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] + ' padas'; }
  /** Child-friendly hint that never reveals the whole shloka. */
  function hint(result, attemptNo) {
    if (result.uncertain) return result.reason === 'no-speech' || result.reason === 'empty'
      ? "I couldn't hear you clearly. Please chant again – no attempt used. 😊"
      : "I'm not fully sure I heard that correctly. Please chant once more, a little slowly – this does not count as an attempt. 🙏";
    const bad = result.padas.filter(p => !p.ok).map(p => p.idx);
    const firstBad = result.words.find(w => w.status !== 'ok');
    if (attemptNo === 1) {
      if (!bad.length && result.extras.length) return 'Please check again. It seems some extra words came in. Try once more.';
      return `Please check again. There seems to be a mistake in ${listPadas(bad.length ? bad : [0])}. Try once more.`;
    }
    if (attemptNo === 2 && firstBad) {
      const inPada = result.words.filter(w => w.pada === firstBad.pada);
      const pos = inPada.indexOf(firstBad);
      const start = firstSyllable(firstBad.text);
      if (firstBad.status === 'missing') return `Good try! In the ${ordinal(firstBad.pada)} pada, a word seems to be missing – the ${ordinal(pos)} word. It begins with "${start}…".`;
      return `Nearly there! In the ${ordinal(firstBad.pada)} pada, look at the ${ordinal(pos)} word. It begins with "${start}…".`;
    }
    const p = bad.length ? bad[0] : 0;
    const count = result.words.filter(w => w.pada === p).length;
    return `Last try – you can do it! 🌟 Take a deep breath. The ${ordinal(p)} pada has ${count} word${count > 1 ? 's' : ''}. Chant slowly.`;
  }
  function firstSyllable(w) {
    const m = (w || '').match(/^(?:[क-हक़-य़]़?्)*[ऄ-हक़-ॡ़]?[ा-ौॢॣ]?/);
    return (m && m[0]) || (w || '').slice(0, 2);
  }
  const api = { devToIast, iastToEasy, toKey, compare, hint, buildReference, firstSyllable, ordinal, isDev };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GSEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
