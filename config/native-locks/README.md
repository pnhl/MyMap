# Reviewed native locks

No fabricated Pod/Gradle locks are checked in. Until actual resolution can run on the matching build host, lock acceptance is BLOCKED and production builds must fail closed. npm lock alone does not freeze CocoaPods or Maven transitives.

On a clean fixture checkout with no credentials, run CNG. iOS: `cd ios && pod install`, then `node scripts/native-locks.cjs capture ios`. Android for each store: `./gradlew :app:dependencies --write-locks --write-verification-metadata sha256`, then `node scripts/native-locks.cjs capture android play` (or amazon). Review repository origins, all transitive checksums and both flavor lock entries; commit the resulting files. Regenerate after any native dependency/plugin change. Never copy signing/Firebase inputs into this folder.

Production CI restores reviewed locks after CNG, uses `pod install --deployment`, and Gradle verifies checksums. This is a genuine pending input, not a completed reproducibility claim.
