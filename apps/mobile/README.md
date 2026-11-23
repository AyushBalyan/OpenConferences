# ConfKit (Android)

A read-only Flutter app for organizers. It has three tabs:

- **Overview**: headline numbers and what needs attention.
- **Analytics**: submissions, review progress, decisions, registrations and revenue.
- **Registrations**: a searchable, filterable list with a detail sheet per registration.

It reads the OpenConferences bot API and never writes anything.

## Connect

1. In the web dashboard open the conference, then Settings, Integrations.
2. Create an integration and issue a key with these permissions:
   - `analytics:read` (Overview and Analytics)
   - `finance:read` (revenue; optional)
   - `registrations:read` (Registrations)
3. Open the app and enter:
   - the API address, for example `api.yourconference.org`;
   - the conference ID (the UUID in the dashboard address);
   - the key.

The key is stored in Android's encrypted storage on the phone. Keys expire after at most 90 days,
so the app asks you to connect again when one runs out.

The server must have the bot API switched on (`BOT_API_ENABLED=true` and `BOT_API_CURSOR_SECRET`).

## Build and install

```bash
flutter build apk --release
```

The APK is written to `build/app/outputs/flutter-apk/app-release.apk`. Either copy it to the phone
and open it, or install over USB with USB debugging on:

```bash
flutter install
```

Release builds use the debug signing key, which is fine for sideloading but not for a store.

## Develop

```bash
flutter analyze
```

```bash
flutter test
```

Debug builds may use plain `http://`, so the emulator can reach a local API at
`http://10.0.2.2:3001`. Release builds accept `https://` only.

## Layout

- `lib/theme/esn_theme.dart`: colors and type taken from esn-press.com.
- `lib/core/`: API client, key storage and Riverpod providers.
- `lib/models/`: JSON models for the two endpoints.
- `lib/features/`: setup screen, tab shell and the three tabs.
- `test/`: model parsing tests and widget tests against a fake API.
