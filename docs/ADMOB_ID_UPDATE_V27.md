# AdMob ID update — MyMap 1.0.0, versionCode 27

The owner supplied a replacement AdMob application and ad unit on October 5, 2026:

- App ID: `ca-app-pub-9161074667002246~7998118867`
- Native unit ID: `ca-app-pub-9161074667002246/5866779544`

Updated `.env`, `.env.example`, and the native Android manifest. Both release channels use the same new IDs. Android versionCode is 27 in both Expo configuration and Gradle so the signed releases can upgrade version 26. VersionName stays 1.0.0.

The latest screenshot of the ad-unit implementation instructions shows the old App ID and old native unit. It does not override the owner's explicit instruction to use the new pair. The owner confirmed the new unit is Native advanced; the app uses Google's native API.

The owner's privacy message screenshot is Published. Its attached application's App ID must be the new App ID above; the displayed name MyMap alone does not distinguish two AdMob app registrations.

## Hosting

Upload `docs/admob-hosting/app-ads.txt` into the public root directory of the developer website. For the supplied domain, the expected URL is `https://mymap.html-5.me/app-ads.txt`. The content must be plain text:

```text
google.com, pub-9161074667002246, DIRECT, f08c47fec0942fa0
```

This record uses the publisher account ID, not the application ID or ad-unit ID. It covers both the old and new AdMob applications owned by this publisher. No hosting deployment was performed in this task.

An unauthenticated HTTP check on October 5, 2026 received HTTP 200 with `Content-Type: text/html` from `https://mymap.html-5.me/app-ads.txt`. The response began with a script loading `/aes.js` and did not contain the publisher record. This confirms the public HTTP response is a JavaScript challenge rather than the plain-text record; it does not prove whether the file has already been uploaded behind that challenge. Configure the hosting to serve this path as public plain text without requiring JavaScript/cookies, or place it on suitable static hosting and update the developer website in the store listing to match that domain. Successful browser display after a challenge alone does not demonstrate crawler access.

Use the same developer website domain in the public store listing. Allow at least 24 hours for the app-ads.txt status to update and use Check for updates when available. [Google setup instructions](https://support.google.com/admob/answer/9363762?hl=en).

For apps listed only in a third-party store, Google currently does not require app-ads.txt app verification. Store linking and app readiness are separate from publishing a privacy message. [Google verification](https://support.google.com/admob/answer/14538460?hl=en), [app readiness](https://support.google.com/admob/answer/10564477?hl=en).

Production requests remain gated by UMP canRequestAds. No consent bypass or test ads are enabled in the delivered production APKs.
