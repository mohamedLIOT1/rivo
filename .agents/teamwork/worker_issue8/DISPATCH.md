## 2026-11-09T08:32:25Z
You are worker_issue8, an expert web frontend engineer.
Your task is to implement the genuine fix for Issue 8 (Requirement R9): Web Content Preferences Podcast Toggle.

Authoritative User Request:
"Add a dedicated toggle in the web application's Content Preferences modal to allow users to enable or disable Podcasts visibility across the interface."

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

NEGATIVE CONSTRAINT:
The team must NOT: read test source code to understand expected behaviour before implementing.

ARCHITECTURAL BLUEPRINT & INVESTIGATION REPORT:
Read: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue8\handoff.md
Also read:
1. c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohamed\Downloads\rivo-main\AGENTS.md
3. c:\Users\mohamed\Downloads\rivo-main\PROJECT.md

EXCLUSIVE WRITE OWNERSHIP (You may ONLY edit these files):
- `src/components/settings/ContentPreferencesCard.jsx`
- `src/components/ContentPreferencesModal.jsx`
- `src/components/ScreenRouter.jsx`
- `src/native/i18n/translations/en/settings.js`
- `src/native/i18n/translations/ar/settings.js`
- Your working directory: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue8\`

IMPLEMENTATION REQUIREMENTS:
1. `src/components/settings/ContentPreferencesCard.jsx`:
   - Import `Podcast` icon from `lucide-react`.
   - Add a third dedicated toggle row for Podcasts with `data-testid="toggle-podcasts"`.
   - Wire it to `contentModes.podcasts !== false`, showing localized status (`ENABLED` / `HIDDEN`), and invoking `toggleContentMode('podcasts', contentModes.podcasts === false)`.
2. `src/components/ContentPreferencesModal.jsx`:
   - Create a clean standalone modal dialog component wrapping `<ContentPreferencesCard />` with modal backdrop, close handler (`onClose`), and theme support, while also re-exporting `ContentPreferencesCard` for backward compatibility.
3. `src/components/ScreenRouter.jsx`:
   - Destructure `showPodcasts` from `usePreferences()`.
   - Guard `{currentScreen === 'podcasts' && showPodcasts && <PodcastScreen ... />}`.
   - If `currentScreen === 'podcasts'` and `!showPodcasts`, automatically route the user back to `'home'` (or `'quran'` if in Quran-only mode).
4. `src/native/i18n/translations/en/settings.js` & `ar/settings.js`:
   - Add localized keys for `settings.podcasts`, `settings.podcastsEnabledDesc`, and `settings.podcastsHiddenDesc` in English and Arabic.
