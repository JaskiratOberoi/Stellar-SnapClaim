# Assistant

A helpful virtual personal assistant for Android, iPhone and Windows, built from
one codebase with [Expo](https://expo.dev) and React Native.

- **Android and iPhone** – the native app, built in the cloud with EAS.
- **Windows** – the same app exported to the web and wrapped in Electron.
- **Web** – runs in any modern browser as a bonus.

## What it does today

- Chat with the assistant by typing or by voice (speech-to-text on Android, iOS
  and Chrome/Safari; text-to-speech everywhere).
- **Offline mode** answers the time, the date, greetings and arithmetic without
  any network.
- **Claude mode** holds full conversations through the Claude API using your own
  API key, which is stored only on the device (secure storage on mobile).
- Settings for your name, assistant mode, voice language and read-aloud.
- The conversation is saved locally and survives restarts.

## Getting started

```bash
npm install
npm start
```

Then press `w` for the web build, scan the QR code with the Expo Go app on your
phone, or press `a` / `i` for an emulator.

Voice input needs the native speech module, which is **not** part of Expo Go.
For voice on a phone, make a development build once (see below).

## Building for Android and iPhone with EAS

Builds run in Expo's cloud, so no Android Studio, Xcode or Mac is needed. The
profiles live in `eas.json`.

One-time setup, done from your own Expo account:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

`init` links this folder to a project on expo.dev and writes the project id
into `app.json`. Commit that change.

| Profile | Command | What you get |
| --- | --- | --- |
| `development` | `npm run eas:dev` | Debug app with the dev client and voice input; loads JS from `npm start`. Android APK, iOS needs a registered device. |
| `development-simulator` | `npm run eas:dev:sim` | Same, for the iOS Simulator on a Mac. |
| `preview` | `npm run eas:preview` | Release build with a shareable install link. Android APK, iOS ad-hoc. |
| `production` | `npm run eas:prod` | Store build. Android AAB, iOS App Store. Build number auto-increments. |

Each script builds both platforms; add `-- --platform android` or
`-- --platform ios` to pick one. The first iOS build asks for an Apple
Developer account (needed for any real-device iOS build); the first Android
build generates and stores a keystore for you.

To publish, after a production build:

```bash
npx eas-cli@latest submit --platform android
```

```bash
npx eas-cli@latest submit --platform ios
```

Android submission needs a Google Play service-account key; iOS needs the
Apple account used for the build.

## Windows desktop

```bash
npm run desktop
```

This opens the Electron shell pointed at the running web dev server (start
`npm run web` first). To produce an installer:

```bash
npm run desktop:build
```

The installer is written to `desktop/release/`.

## Project layout

```
src/app/            Expo Router screens (index = chat, settings)
src/components/     UI building blocks
src/hooks/          use-chat, use-settings, theming
src/services/
  assistant/        AssistantProvider contract, offline + Claude implementations
  speech/           text-to-speech and speech-to-text wrappers
  storage/          settings, API key and conversation persistence
desktop/            Electron shell for Windows
```

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run web:export` | Static web export to `dist/` |
| `npx expo-doctor` | Diagnose dependency and config problems |
