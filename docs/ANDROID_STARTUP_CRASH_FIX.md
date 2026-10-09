# Android 14 startup crash — Vivo Y22s

The connected Vivo Y22s (Android 14, ARM64) recorded repeated fatal exceptions from MyMap 1.0.0, version code 24:

```
Requested job cannot be persisted without holding android.permission.RECEIVE_BOOT_COMPLETED permission
```

The stack traces pass through `LocationTaskConsumer`, `TaskManagerUtils.updateOrScheduleJob`, and Android `JobScheduler`. Expo TaskManager calls `JobInfo.Builder.setPersisted(true)` for location delivery. MyMap's manifest lacked the normal `RECEIVE_BOOT_COMPLETED` permission required for that call. A location callback or restored background task could therefore terminate the native process before JavaScript handled it. A fresh emulator without the same active location task did not initially reproduce the failure.

The fix adds the required permission to the common Android manifest, Expo configuration, and the idempotent `withMyMapAndroid` plugin. Both Android and Amazon flavors inherit it. No runtime permission dialog, account reset, database reset, or application uninstall is needed.

The regression test checks the dependency's persisted-job requirement against the manifest and both regeneration inputs. It failed before the fix and passed afterward. The complete suite contains 92 passing tests; TypeScript passes. Both merged release manifests contain the permission.

The replacement Android APK was installed with `adb install -r` on the connected Vivo, preserving application data. Android reported `RECEIVE_BOOT_COMPLETED: granted=true`. Three subsequent cold launches succeeded, the process remained alive, and the Expo location foreground service was restored. The crash buffer and React Native/Android Runtime error capture from the replacement timestamp were empty during the observation window. The phone also returned to its home screen while MyMap's location service remained active. This validates startup and service restoration; it is not a new 40 km physical journey or proof against Vivo's long-term battery restrictions.

Both release APKs are version 1.0.0, code 24, ARMv7/ARM64, verified with the project's existing signing certificate. SHA-256:

- Android: `B274CC93B7FC74A8D3EA61DC1717B9BF917C0C6D92E4D67995CAC48368512E20`
- Amazon: `C3493179770BB6A40F418FAEF2A2DA36CAE28962518AD99E2A062C9FD0FA3E29`

The old installed Android APK matched the earlier release hash `66DE1E7E09F585DC2C34A6A6C61E6FB9E65C024E9A82C79425685ADA92973120`. Private device logs and screenshots remain in `.local`; they are not part of the public documentation.

Reference: [Android JobInfo.Builder.setPersisted](https://developer.android.com/reference/android/app/job/JobInfo.Builder#setPersisted(boolean)).
