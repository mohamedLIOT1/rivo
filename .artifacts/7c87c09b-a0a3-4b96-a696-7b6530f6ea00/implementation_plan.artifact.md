# Implementation Plan - Fix App Registration, White Screen, and Icon Identity

This plan addresses the critical "main has not been registered" crash, the white screen on startup, and the persistent icon color issue.

## User Review Required

> [!IMPORTANT]
> **App Crash**: The app is crashing with "main has not been registered". This is why you see a white screen and then an error. I will fix this by creating a dedicated entry point.
> **The Yellow Icon**: I am changing the Green color code to a deeper, more distinct "Forest Green" (`#14833B`) to avoid it looking yellowish on some screens, and I will verify the foreground layer.
> **Splash Screen**: I will ensure the splash screen matches the new green color to eliminate the white flash.

## Proposed Changes

### 1. Fix App Registration (Emergency)
#### [NEW] [index.js](file:///C:/Users/mohamed/Desktop/liofy/index.js)
Create a clean entry point that explicitly registers the "main" component to match `MainActivity.kt`.
```javascript
import { registerRootComponent } from 'expo';
import App from './App';

// This ensures the JS side matches the "main" name expected by the Android side
registerRootComponent(App);
```

#### [MODIFY] [package.json](file:///C:/Users/mohamed/Desktop/liofy/package.json)
Point the entry point to our new `index.js` instead of the internal expo entry.
```diff
- "main": "node_modules/expo/AppEntry.js",
+ "main": "index.js",
```

### 2. Fix Splash & Icon Identity
#### [MODIFY] [colors.xml](file:///C:/Users/mohamed/Desktop/liofy/android/app/src/main/res/values/colors.xml)
Use a more robust green (`#1DB954` or `#14833B`) and ensure it's applied to all native background layers.
```xml
<color name="splashscreen_background">#1DB954</color>
<color name="iconBackground">#1DB954</color>
```

#### [MODIFY] [app.json](file:///C:/Users/mohamed/Desktop/liofy/app.json)
Ensure the background colors match and the splash screen is configured correctly.

### 3. Smooth Animations
#### [MODIFY] [HomeScreen.js](file:///C:/Users/mohamed/Desktop/liofy/src/mobile/screens/HomeScreen.js)
Ensure the entrance animation triggers as soon as the component mounts, even if tracks are still loading, to avoid a "stiff" feeling.

## Verification Plan

### Manual Verification
1.  **Launch**: Open the app and verify the "main has not been registered" error is GONE.
2.  **Visuals**: Confirm the background of the icon and splash screen is now a solid Green.
3.  **Feel**: Check if the Home screen content fades in smoothly.
