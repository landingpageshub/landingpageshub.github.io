# Gita Sadhana – Your AI Chanting Companion 🪷

A mobile-first web app for chanting, memorising, revising and understanding Bhagavad Gita shlokas.
*One shloka at a time, one chapter at a time, every day. Hare Krishna!*

## What is in this folder

| File | What it does |
|---|---|
| `index.html` | App shell and design (cream, saffron, gold, green; lotus and peacock feather) |
| `app.js` | All screens: sign up/login, dashboard, the 3 revision modes, history, 5 tools, progress, profile and reminders |
| `engine.js` | **Shloka comparison engine**. Checks pada by pada and word by word against the reference text. The same engine is used for voice, text and landmark recall |
| `config.js` | Supabase project URL and publishable key (already filled in) |
| `data/shlokas.json` | Versioned import file: 18 chapters, 701 shlokas in Devanagari, split into padas |
| `vendor/` | Supabase JavaScript library (bundled, so no outside script is needed) |
| `supabase/migrations/` | Database schema with Row Level Security (already applied to your project) |
| `supabase/functions/explain-shloka/` | Edge function for Tool 4, Meanings (already deployed) |
| `tests/engine.test.js` | Engine tests: run `node tests/engine.test.js` |

## Setup (about 10 minutes, one time)

**1. Put the app online (free).**
Go to https://app.netlify.com/drop and drag this whole folder onto the page.
Netlify gives you an `https://…netlify.app` link. Open it on the phone in Chrome (Android) or Safari (iPhone).
Use "Add to Home screen" so it opens like an app.
The microphone only works on an `https://` link.

**2. Tell Supabase the app's address.**
In the Supabase dashboard, open project *AI For Kids To Make Them Study Better*, then Authentication → URL Configuration.
- Set **Site URL** to your Netlify link.
- Add the same link under **Redirect URLs**.

This makes the confirmation and password-reset emails open the app.
Optional: under Authentication → Providers → Email, turn off "Confirm email" so your child can log in straight after signing up.

**3. Sign up and start.** Choose a chapter, then Voice or Text, then Start.

**4. (Optional) Turn on Tool 4, Meanings.**
In Supabase, open Edge Functions → Secrets and add `ANTHROPIC_API_KEY` (from console.anthropic.com).
- Each shloka's explanation is generated once, then saved and reused.
- Every explanation is labelled "AI-generated, not an official commentary".
- Until the key is added, Tool 4 still shows the shloka and a friendly "not switched on yet" message.

**5. (Optional) Daily 9 AM call with Bolna.**
The voice agent **"Gita Sadhana – Daily Reminder"** has been created in your Bolna account. No calls have been placed.
Calls start only after all three of these:
- a parent enters the phone number in Profile;
- the consent box is ticked;
- the daily scheduler is switched on.

Bolna calls Indian numbers through its telephony partner. The number may need verifying in Bolna, and it must not be on DND for promotional calls.
Without the call, the app still shows an in-app reminder after the reminder time, plus a phone notification while the app is open.

## How the chanting check works (honest notes)

- **Voice** uses the browser's own speech recognition in Hindi (`hi-IN`). It writes Devanagari, which is the closest option browsers offer for Sanskrit. It has **not yet been tested with real chanting**: please try it on day 1 and tell me where it mishears.
- The engine turns everything (Devanagari, IAST or plain English letters) into a sound key.
- It allows for:
  - sandhi and word-spacing differences;
  - anusvara/nasal variants;
  - visarga;
  - short/long vowels and aspirated letters.
- It then lines up each pada and word against the reference text.
- Voice mode is more forgiving than text mode.
- If the recording is too short or unclear, the child is asked to chant again, and **no attempt is used**.
- "Fix what was heard" lets the child correct a misheard transcript. This replaces the attempt rather than using a new one, and is saved as `manual_correct`.
- The full shloka is shown only after 3 tries.

## Text source

The Devanagari text comes from the public-domain **gita/gita** dataset (github.com/gita/gita).
- It has 701 verses: Chapter 13 has 35 and starts with Arjuna's question, the same total as *Song of God*.
- About 11 verses (for example 1.26, 2.42 and 11.26) are divided or grouped a little differently in some books. The app shows a "compare with your book" note on these.
- The transliteration is generated from the Devanagari, so the two views always match.
- No translation or commentary from any teacher is included.

## Data and privacy

- Every table is private to its owner (Row Level Security has been tested).
- Voice recordings are **off by default**. When switched on, they go to a private storage bucket.
- Profile → "Delete my account & data" removes everything.
- The publishable key in `config.js` is designed to be public. Never put a secret key in this folder.
