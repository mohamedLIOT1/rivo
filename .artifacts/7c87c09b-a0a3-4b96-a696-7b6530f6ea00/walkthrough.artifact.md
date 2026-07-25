# Walkthrough - Fixed Gradle Sync Error

I have resolved the `MissingPropertyException` that was occurring during Gradle sync.

## Changes Made

### expo-modules-core

#### [MODIFY] [ExpoModulesCorePlugin.gradle](file:///C:/Users/mohamed/Desktop/liofy/node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle)

Updated the `useExpoPublishing` logic to safely check for the existence of the `release` software component before attempting to use it for Maven publication. This prevents the "Could not get unknown property 'release'" error in projects where the component isn't yet available during the `afterEvaluate` phase.

```diff
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

## Verification Results

### Manual Verification
- The modification uses standard Gradle APIs (`findByName`) to avoid crashing when a property is missing.
- You should now be able to **Sync Project with Gradle Files** in Android Studio without encountering this specific error.

> [!TIP]
> Since this change is inside `node_modules`, it will be overwritten if you run `npm install` or `yarn`. Use `npx patch-package expo-modules-core` to make this fix permanent.
