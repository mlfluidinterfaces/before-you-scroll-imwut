# Before You Scroll — In-the-Wild Data Collection App

Companion Android app for the paper:

**Before You Scroll Again: Predicting Regretful Social Media Sessions from In-the-Wild Contextual and Wearable Sensing**
Sally Ahmed, Jan Enkmann, Kye Shimizu, Ivy Yip, Vincent Beermann, Ayse Alomar, Falk Uebernickel, Pattie Maes.
arXiv:2606.08965 [cs.HC] (8 Jun 2026) — https://arxiv.org/abs/2606.08965

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
