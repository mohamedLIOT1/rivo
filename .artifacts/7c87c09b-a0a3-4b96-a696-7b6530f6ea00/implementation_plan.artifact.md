# Implementation Plan - Fix Gradle Sync Error in Expo Modules

The project is failing to sync with the error: `Could not get unknown property 'release' for SoftwareComponent container`. This occurs because `ExpoModulesCorePlugin.gradle` tries to access `components.release` during `afterEvaluate`, but for some modules (like `:expo`), this component might not be registered or available yet, especially with newer versions of the Android Gradle Plugin (AGP 8+).

## User Review Required

> [!IMPORTANT]
> The fix involves modifying a file inside `node_modules`. These changes will be lost if you reinstall your dependencies (`npm install` or `yarn install`). It is highly recommended to use [patch-package](https://www.npmjs.com/package/patch-package) to persist this fix.

## Proposed Changes

### expo-modules-core

#### [MODIFY] [ExpoModulesCorePlugin.gradle](file:///C:/Users/mohamed/Desktop/liofy/node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle)

Update the `useExpoPublishing` function to safely access the `release` component. Using `components.findByName("release")` prevents a `MissingPropertyException` if the component is missing.

```diff
   project.afterEvaluate {
     publishing {
       publications {
         release(MavenPublication) {
-          from components.release
+          def releaseComponent = components.findByName("release")
+          if (releaseComponent) {
+            from releaseComponent
+          }
         }
       }
```

## Verification Plan

### Manual Verification
- Run a Gradle sync in Android Studio to ensure the error is resolved.
- If the sync passes, the fix is successful.
