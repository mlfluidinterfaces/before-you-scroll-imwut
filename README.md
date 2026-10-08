# Before You Scroll — In-the-Wild Data Collection App

Companion Android app for the paper:

**Before You Scroll Again: Predicting Regretful Social Media Sessions from In-the-Wild Contextual and Wearable Sensing**
Sally Ahmed, Jan Enkmann, Kye Shimizu, Ivy Yip, Vincent Beermann, Ayse Alomar, Falk Uebernickel, Pattie Maes.
arXiv:2606.08965 [cs.HC] (8 Jun 2026) — https://arxiv.org/abs/2606.08965

## What this repo is

This app was the experience-sampling + passive-logging instrument for the paper's 7-day in-the-wild study (21 participants, 1,445 sessions). It pairs with a low-cost consumer smartwatch (Bangle.js 2) and collects:

- **Passive smartphone logging** — hourly app-usage polls plus app start/stop events captured on-device via Android UsageStats and an accessibility service (native Kotlin modules, WorkManager scheduling, offline-first upload queue).
- **Session-level surveys** — after phone-use sessions: regret ("I feel regret about this phone use session"), perceived time vs. intended ("compared with what you had intended…"), and meaningfulness, all on 7-point scales.
- **End-of-day surveys** — how sessions started/ended, overall feeling, and energy level.
- **Bedtime preference** — a first-launch bedtime prompt so end-of-day survey notifications arrive before sleep.

All records are stored in Supabase (PostgreSQL). There is no product analytics in this build.

## Paper findings this app supports

1. **Intention–behavior gap beats duration.** The gap between intended and actual use predicts regret far more strongly than session duration; duration's apparent effect collapses once intention is modeled. The session survey's time-comparison item is the key label here.
2. **Regret is about displaced alternatives.** Regret is amplified at night and following productivity-app use — patterns the hourly usage polls + event stream + bedtime-aware EOD scheduling are designed to capture.
3. **Two-layer prediction.** Pre-session contextual features generalize across participants while physiology adds person-specific lift — pointing to just-in-time adaptive interventions rather than timer-based ones. Interviews surfaced scrolling-as-avoidance and time blindness as mechanisms.

## Repo structure

- `app/` — Expo Router screens: home (permissions, collection status), session survey, end-of-day survey, debug page.
- `android/app/src/main/java/.../screentimeApp/` — native modules: usage collection, event logging, Supabase upload client, notification service, WorkManager worker.
- `modules/` — TypeScript bridge to the native module.
- `utils/` — Supabase client, user identity (SecureStore UUID), notifications.
- `components/` — bedtime (`SleepTimeModal`) picker.
- `scripts/` — notification senders (Expo/FCM/EOD), version bump. Analysis and export scripts are intentionally not included.
- `android/app/google-services.json.example`, `firebase-service-account.json.example`, `.env.example` — placeholder configs (see Setup).

## Setup

1. Copy configs and fill in your own values (never commit secrets):
   ```bash
   cp .env.example .env
   cp android/app/google-services.json.example android/app/google-services.json
   ```
   Required: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   Optional: `EXPO_PUBLIC_SENTRY_DSN` (error reporting, disabled when empty), `EAS_PROJECT_ID` / `EXPO_UPDATES_URL` (Expo Updates), `SENTRY_ORG` / `SENTRY_PROJECT`.
2. Install and run:
   ```bash
   npm install
   npm run android
   ```
3. Grant Usage Access + Accessibility permissions in-app, then start hourly collection.

## Data schema (Supabase)

- `users_screentime` — device UUID, push token, bedtime.
- `session_surveys` — per-session regret, time comparison, meaningfulness.
- `eod_surveys` — session start/end patterns, feeling, energy.
- `usage_pull_screentime` — hourly poll windows per user.
- `app_events_screentime` — app start/stop events with timestamps.
- `app_data_screentime` — aggregated per-app usage per pull.

## Privacy

This is a research instrument: it logs fine-grained app usage. Data stays in your own Supabase project. Exported datasets and credentials are gitignored by default — keep it that way before publishing any fork.

## Citation

```bibtex
@misc{ahmed2026beforeyouscroll,
  title  = {Before You Scroll Again: Predicting Regretful Social Media Sessions from In-the-Wild Contextual and Wearable Sensing},
  author = {Ahmed, Sally and Enkmann, Jan and Shimizu, Kye and Yip, Ivy and Beermann, Vincent and Alomar, Ayse and Uebernickel, Falk and Maes, Pattie},
  year   = {2026},
  eprint = {2606.08965},
  archivePrefix = {arXiv},
  primaryClass  = {cs.HC}
}
```
