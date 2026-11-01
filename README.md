# Assistant

A personal assistant that is also your storehouse: tasks, reminders and
expenses, kept on your device and driven by plain language. One codebase for
Android, iPhone and Windows, built with [Expo](https://expo.dev) and React
Native.

## What it does

- **Today** – what is due, what is overdue, upcoming reminders, this month's
  spend and recent expenses, with a quick-add bar that understands sentences
  like `call Ravi tomorrow 5pm` or `250 lunch`.
- **Tasks** – open, today, reminders and done views; priorities; due dates;
  reminders that fire as local notifications on the phone.
- **Expenses** – month-by-month list grouped by day, totals, category breakdown,
  automatic category guessing from the note, any currency.
- **Assistant** – a chat that reads and writes the same store. Type or speak
  `remind me to pay rent on the 5th`, `spent 1200 on electricity yesterday`,
  `show my tasks`, `what did I spend this month`. Replies can be read aloud.
  - **Offline mode** handles all store commands plus the time, date and
    arithmetic with no network.
  - **Claude mode** adds real conversation and uses tools over the store, with
    your own API key kept on the device.
- Everything is stored locally (AsyncStorage; the API key in secure storage).

## Getting started

```bash
npm install
npm start
```

Press `w` for the web build, scan the QR code with Expo Go, or press `a` / `i`
for an emulator. Voice input and reminder notifications need the native
modules, which are **not** part of Expo Go: use a development build (below).

## Building for Android and iPhone with EAS

Builds run in Expo's cloud, so no Android Studio, Xcode or Mac is needed. The
profiles live in `eas.json`; the project is linked to the `jaskiratoberoi-noble`
Expo account.

| Profile | Command | What you get |
| --- | --- | --- |
| `development` | `npm run eas:dev` | Debug app with the dev client, voice and notifications; loads JS from `npm start`. Android APK, iOS needs a registered device. |
| `development-simulator` | `npm run eas:dev:sim` | Same, for the iOS Simulator on a Mac. |
| `preview` | `npm run eas:preview` | Release build with a shareable install link. |
| `production` | `npm run eas:prod` | Store build. Build number auto-increments. |

Each script builds both platforms; add `-- --platform android` or
`-- --platform ios` to pick one. iOS device builds need an Apple Developer
account. To publish after a production build:

```bash
npx eas-cli@latest submit --platform android
```

## Windows desktop

```bash
npm run desktop
```

Opens the Electron shell against the running web dev server (start `npm run
web` first). `npm run desktop:build` writes an installer to `desktop/release/`.

## Project layout

```
src/app/
  (tabs)/           Today, Tasks, Expenses, Assistant
  task/[id].tsx     task editor (id "new" creates)
  expense/[id].tsx  expense editor
  settings.tsx
src/components/     rows, chips, quick-add bar, date field, chat pieces
src/hooks/          use-store (tasks + expenses), use-settings, use-chat
src/services/
  store/            domain types and persistence
  nlp/              parse-command: sentences -> structured commands
  assistant/        AssistantProvider contract, actions, offline + Claude
  reminders/        local notifications
  speech/           text-to-speech and speech-to-text
desktop/            Electron shell for Windows
```

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type check |
| `npm run lint` | ESLint |
| `npm run web:export` | Static web export to `dist/` |
| `npx expo-doctor` | Diagnose dependency and config problems |
