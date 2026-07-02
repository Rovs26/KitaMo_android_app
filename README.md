# KitaMo Android

Expo React Native foundation for the local-first KitaMo Android MVP.

## Current Phase

Android Phase 1: Project Foundation.

This phase contains placeholder navigation, theme tokens, lightweight state stores, and local-first persistence stubs only.

## Run

```sh
npm install
npm run typecheck
npm run lint
npm run start
```

For Android:

```sh
npm run android
```

## Included

- Expo React Native with TypeScript.
- Expo Router route structure for Owner and Kiosk areas.
- Placeholder screens only.
- Theme token foundation with light, dark, and system-ready mode support.
- Zustand stores for app, kiosk, and theme state.
- SQLite client/schema placeholders.
- Service placeholders for offline queue, sync stub, receipt sharing, and pilot data.

## Intentionally Deferred

- Supabase sync.
- Login, Clerk, or auth.
- Lis API or live AI.
- Camera, OCR, voice, or file extraction.
- Bluetooth printing.
- Customer Mode.
- LGU Mode.
- Play Store production release work.

## PWA Safety

The reference PWA repo lives at `/Users/rovs/Documents/KitaMo`. Do not modify it from this Android project. Adapt only simple, safe domain ideas when explicitly needed.
