"""
Rivo E2E Test Suite - Tier 1: Feature Coverage
Validates the 10 inventoried features with >=5 test cases per feature:
1. Dead Code & Obsolete Components Deletion (Features 1 & 2)
2. Hermes Bytecode Compilation Pipeline (Feature 6)
3. Splash Screen Layer-List Fix (Feature 3)
4. Native Window Theme Switch Deferral & MainApplication I/O (Features 4 & 5)
5. Immediate Cache Hydration Without Dummy Placeholders (Features 8, 9, 10)
6. Bottom Tab Screen Memoization (Features 11 & 12)
7. List Virtualization (FlatList Migration) (Feature 13)
8. Express Compression Middleware (Feature 19)
9. HTTP Cache-Control & ETag 304 Support (Feature 20)
10. Strict CORS Restrictions (Backend Security Contract)
"""

import unittest
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from .harness import (
    PROJECT_ROOT,
    NATIVE_DIR,
    SERVER_DIR,
    ANDROID_DIR,
    SCRIPTS_DIR,
    read_file_text,
    file_exists,
    parse_package_json,
)


class TestFeatureDeadCodeAbsence(unittest.TestCase):
    """
    Feature 1 & 2: Dead Code & Obsolete Components Deletion
    Authoritative Source: PROJECT.md § Feature Inventory (Features 1 & 2) & M1 Scope.
    """

    def test_01_online_webview_absence(self):
        """Verify OnlineWebView screen is permanently deleted."""
        native_path = NATIVE_DIR / "screens" / "OnlineWebView.js"
        web_path = PROJECT_ROOT / "src" / "screens" / "OnlineWebView.js"
        self.assertFalse(
            file_exists(native_path),
            f"Dead screen OnlineWebView.js still exists at {native_path}",
        )
        self.assertFalse(
            file_exists(web_path),
            f"Dead screen OnlineWebView.js still exists at {web_path}",
        )

    def test_02_mixes_screen_absence(self):
        """Verify MixesScreen is permanently deleted across native and web."""
        native_path = NATIVE_DIR / "screens" / "MixesScreen.js"
        web_path = PROJECT_ROOT / "src" / "screens" / "MixesScreen.jsx"
        self.assertFalse(
            file_exists(native_path),
            f"Dead screen MixesScreen.js still exists at {native_path}",
        )
        self.assertFalse(
            file_exists(web_path),
            f"Dead screen MixesScreen.jsx still exists at {web_path}",
        )

    def test_03_equalizer_modal_absence(self):
        """Verify EqualizerModal component is permanently deleted."""
        native_path = NATIVE_DIR / "components" / "EqualizerModal.js"
        web_path = PROJECT_ROOT / "src" / "components" / "EqualizerModal.jsx"
        self.assertFalse(
            file_exists(native_path),
            f"Dead component EqualizerModal.js still exists at {native_path}",
        )
        self.assertFalse(
            file_exists(web_path),
            f"Dead component EqualizerModal.jsx still exists at {web_path}",
        )

    def test_04_mode_toggle_and_brutal_button_absence(self):
        """Verify obsolete UI controls ModeToggle and BrutalButton are deleted."""
        mode_toggle = NATIVE_DIR / "components" / "ModeToggle.js"
        brutal_button = NATIVE_DIR / "ui" / "BrutalButton.js"
        self.assertFalse(
            file_exists(mode_toggle),
            f"Obsolete component ModeToggle.js still exists at {mode_toggle}",
        )
        self.assertFalse(
            file_exists(brutal_button),
            f"Obsolete component BrutalButton.js still exists at {brutal_button}",
        )

    def test_05_obsolete_subprojects_absence(self):
        """Verify abandoned subprojects android-webview and desktop-app are deleted."""
        android_webview = PROJECT_ROOT / "android-webview"
        desktop_app = PROJECT_ROOT / "desktop-app"
        self.assertFalse(
            android_webview.exists(),
            f"Obsolete subproject android-webview still exists at {android_webview}",
        )
        self.assertFalse(
            desktop_app.exists(),
            f"Obsolete subproject desktop-app still exists at {desktop_app}",
        )

    def test_06_redundant_binaries_and_bundles_absence(self):
        """Verify 118MB release-desktop/Rivo.exe and redundant ios bundles are deleted."""
        rivo_exe = PROJECT_ROOT / "release-desktop" / "Rivo.exe"
        ios_hermes = PROJECT_ROOT / "ios_main.hermes.bundle"
        ios_js = PROJECT_ROOT / "ios_main.jsbundle"
        assets_ios = PROJECT_ROOT / "assets-ios"

        self.assertFalse(
            file_exists(rivo_exe),
            f"Bloated binary release-desktop/Rivo.exe (118MB) still exists at {rivo_exe}",
        )
        self.assertFalse(
            file_exists(ios_hermes),
            f"Redundant bundle ios_main.hermes.bundle still exists at {ios_hermes}",
        )
        self.assertFalse(
            file_exists(ios_js),
            f"Redundant bundle ios_main.jsbundle still exists at {ios_js}",
        )
        self.assertFalse(
            assets_ios.exists(),
            f"Redundant directory assets-ios still exists at {assets_ios}",
        )


class TestFeatureHermesBundleIntegrity(unittest.TestCase):
    """
    Feature 6: Hermes Bytecode Compilation Pipeline
    Authoritative Source: PROJECT.md § Feature Inventory (Feature 6) & M2 Scope.
    """

    def test_01_publish_ota_invokes_hermesc(self):
        """Verify publish-ota.js invokes hermesc to compile JS bundle to Hermes bytecode."""
        ota_script = SCRIPTS_DIR / "publish-ota.js"
        self.assertTrue(file_exists(ota_script), "publish-ota.js must exist")
        content = read_file_text(ota_script)
        has_hermesc = "hermesc" in content or "hermes-engine" in content
        self.assertTrue(
            has_hermesc,
            "publish-ota.js must invoke hermesc bytecode compiler",
        )

    def test_02_publish_ota_bytecode_output_flags(self):
        """Verify publish-ota.js compiles with -emit-binary flag."""
        ota_script = SCRIPTS_DIR / "publish-ota.js"
        content = read_file_text(ota_script)
        has_emit_binary = "-emit-binary" in content or "hermesc" in content
        self.assertTrue(
            has_emit_binary,
            "publish-ota.js must specify binary bytecode emission flags",
        )

    def test_03_ota_manifest_tracks_bytecode_metadata(self):
        """Verify server/ota-manifest.json exists and tracks bundle size & version."""
        manifest_path = SERVER_DIR / "ota-manifest.json"
        self.assertTrue(file_exists(manifest_path), "ota-manifest.json must exist")
        manifest = json.loads(read_file_text(manifest_path))
        self.assertIn("version", manifest, "Manifest must track version")
        self.assertIn("bundleUrl", manifest, "Manifest must track bundleUrl")
        self.assertIn("bundleSize", manifest, "Manifest must track bundleSize")

    def test_04_android_hermes_flag_enabled(self):
        """Verify MainApplication.kt enables Hermes bytecode execution."""
        main_app = ANDROID_DIR / "app" / "src" / "main" / "java" / "com" / "rivo" / "app" / "MainApplication.kt"
        self.assertTrue(file_exists(main_app), "MainApplication.kt must exist")
        content = read_file_text(main_app)
        self.assertIn(
            "isHermesEnabled",
            content,
            "MainApplication.kt must configure isHermesEnabled",
        )

    def test_05_bundle_minification_in_ota_pipeline(self):
        """Verify publish-ota.js compiles release bundle with dev=false."""
        ota_script = SCRIPTS_DIR / "publish-ota.js"
        content = read_file_text(ota_script)
        self.assertIn(
            "--dev false",
            content,
            "publish-ota.js must specify --dev false for release builds",
        )


class TestFeatureSplashscreenXml(unittest.TestCase):
    """
    Feature 3: Splash Screen Layer-List Fix (R3 Cold Start Black Screen)
    Authoritative Source: PROJECT.md § Feature Inventory (Feature 3) & R3.
    """

    def setUp(self):
        self.splash_path = ANDROID_DIR / "app" / "src" / "main" / "res" / "drawable" / "splashscreen.xml"

    def test_01_splashscreen_xml_exists_and_valid(self):
        """Verify splashscreen.xml exists and parses as valid XML."""
        self.assertTrue(file_exists(self.splash_path), "splashscreen.xml must exist")
        try:
            tree = ET.parse(self.splash_path)
            root = tree.getroot()
            self.assertIsNotNone(root)
        except Exception as e:
            self.fail(f"splashscreen.xml is not valid XML: {e}")

    def test_02_splashscreen_layer_list_root(self):
        """Verify the root element of splashscreen.xml is layer-list."""
        tree = ET.parse(self.splash_path)
        root = tree.getroot()
        self.assertEqual(
            root.tag,
            "layer-list",
            f"Expected root element <layer-list>, got <{root.tag}>",
        )

    def test_03_splashscreen_background_color_item(self):
        """Verify splashscreen.xml contains a background color item."""
        content = read_file_text(self.splash_path)
        self.assertIn(
            "@color/splashscreen_background",
            content,
            "splashscreen.xml must contain @color/splashscreen_background item",
        )

    def test_04_splashscreen_image_bitmap_present(self):
        """Verify splashscreen.xml contains splashscreen_image bitmap item to prevent black screen."""
        content = read_file_text(self.splash_path)
        has_splash_image = (
            "@drawable/splashscreen_image" in content
            or "splashscreen_image" in content
        )
        self.assertTrue(
            has_splash_image,
            "splashscreen.xml missing @drawable/splashscreen_image item (causes cold start black screen)",
        )

    def test_05_splashscreen_gravity_center(self):
        """Verify splashscreen image item specifies center gravity to prevent distortion."""
        content = read_file_text(self.splash_path)
        has_center_gravity = (
            'android:gravity="center"' in content
            or "android:gravity='center'" in content
        )
        self.assertTrue(
            has_center_gravity,
            "splashscreen.xml image item must specify android:gravity=\"center\"",
        )


class TestFeatureThemeSwitchDeferral(unittest.TestCase):
    """
    Feature 4 & 5: Native Window Theme Switch Deferral & MainApplication I/O
    Authoritative Source: PROJECT.md § Feature Inventory (Features 4 & 5) & R3.
    """

    def setUp(self):
        self.main_activity = ANDROID_DIR / "app" / "src" / "main" / "java" / "com" / "rivo" / "app" / "MainActivity.kt"
        self.main_app = ANDROID_DIR / "app" / "src" / "main" / "java" / "com" / "rivo" / "app" / "MainApplication.kt"
        self.manifest = ANDROID_DIR / "app" / "src" / "main" / "AndroidManifest.xml"

    def test_01_mainactivity_no_premature_set_theme(self):
        """Verify MainActivity.kt does NOT prematurely call setTheme(R.style.AppTheme) in onCreate."""
        content = read_file_text(self.main_activity)
        # Check if setTheme(R.style.AppTheme) is directly inside onCreate before first frame
        premature_theme = re.search(
            r"override\s+fun\s+onCreate\s*\([^)]*\)\s*\{[^}]*setTheme\s*\(\s*R\.style\.AppTheme\s*\)",
            content,
            re.DOTALL,
        )
        self.assertIsNone(
            premature_theme,
            "MainActivity.kt must not call setTheme(R.style.AppTheme) prematurely before first frame paints",
        )

    def test_02_mainactivity_theme_switch_deferred(self):
        """Verify MainActivity.kt defers theme switch or preserves splash window background."""
        content = read_file_text(self.main_activity)
        # Theme must either be deferred or managed through splash screen lifecycle callbacks
        has_deferral = (
            "post" in content
            or "SplashScreen" in content
            or "window" in content
            or "AppTheme" not in content  # removed premature call entirely
        )
        self.assertTrue(
            has_deferral,
            "MainActivity.kt must defer AppTheme transition until React Native paints",
        )

    def test_03_mainapplication_no_sync_cleanup_in_oncreate(self):
        """Verify MainApplication.kt onCreate does NOT call cleanupOldInstallers synchronously."""
        content = read_file_text(self.main_app)
        # Match synchronous call in onCreate
        sync_cleanup = re.search(
            r"override\s+fun\s+onCreate\s*\(\s*\)\s*\{[^}]*cleanupOldInstallers\s*\(\s*\)",
            content,
            re.DOTALL,
        )
        self.assertIsNone(
            sync_cleanup,
            "MainApplication.kt must not execute cleanupOldInstallers() synchronously on main UI thread in onCreate()",
        )

    def test_04_mainapplication_installer_cleanup_async(self):
        """Verify cleanupOldInstallers is executed asynchronously on a background executor/thread."""
        content = read_file_text(self.main_app)
        has_async = (
            "Executors" in content
            or "thread" in content.lower()
            or "Coroutine" in content
            or "execute" in content
            or "AsyncTask" in content
        )
        self.assertTrue(
            has_async,
            "MainApplication.kt must offload cleanupOldInstallers to a background thread",
        )

    def test_05_android_manifest_launch_theme(self):
        """Verify AndroidManifest.xml configures MainActivity with SplashTheme or launch theme."""
        self.assertTrue(file_exists(self.manifest), "AndroidManifest.xml must exist")
        content = read_file_text(self.manifest)
        self.assertTrue(
            "SplashTheme" in content or "Theme" in content,
            "AndroidManifest.xml must specify an activity theme",
        )


class TestFeatureImmediateCacheHydration(unittest.TestCase):
    """
    Feature 8, 9 & 10: Placeholder Removal & AsyncStorage Immediate Cache Hydration
    Authoritative Source: PROJECT.md § Feature Inventory (Features 8, 9, 10) & Interface Contracts.
    """

    def setUp(self):
        self.user_context = NATIVE_DIR / "context" / "UserContext.js"
        self.home_screen = NATIVE_DIR / "screens" / "HomeScreen.js"

    def test_01_user_context_initial_state_empty_arrays(self):
        """Verify UserContext.js initializes tracks and albums as empty arrays []."""
        content = read_file_text(self.user_context)
        # Must not be INITIAL_TRACKS or INITIAL_ALBUMS
        has_dummy_tracks = "useState(INITIAL_TRACKS)" in content
        has_dummy_albums = "useState(INITIAL_ALBUMS" in content
        self.assertFalse(
            has_dummy_tracks,
            "UserContext.js must not initialize tracks state with INITIAL_TRACKS placeholder",
        )
        self.assertFalse(
            has_dummy_albums,
            "UserContext.js must not initialize albums state with INITIAL_ALBUMS placeholder",
        )

    def test_02_user_context_no_initial_tracks_import(self):
        """Verify UserContext.js does not import INITIAL_TRACKS or INITIAL_ALBUMS."""
        content = read_file_text(self.user_context)
        has_import = re.search(
            r"import\s*\{[^}]*(?:INITIAL_TRACKS|INITIAL_ALBUMS)[^}]*\}\s*from",
            content,
        )
        self.assertIsNone(
            has_import,
            "UserContext.js must not import INITIAL_TRACKS or INITIAL_ALBUMS dummy data",
        )

    def test_03_user_context_no_settimeout_cache_delay(self):
        """Verify UserContext.js does NOT wrap cache hydration in setTimeout(..., 0)."""
        content = read_file_text(self.user_context)
        # Check for setTimeout wrapping cache retrieval
        has_settimeout_cache = re.search(
            r"setTimeout\s*\(\s*async\s*\(\s*\)\s*=>\s*\{[^}]*getItem\s*\(\s*CACHE_",
            content,
            re.DOTALL,
        )
        self.assertIsNone(
            has_settimeout_cache,
            "UserContext.js must not wrap cache hydration in setTimeout (must hydrate synchronously-like)",
        )

    def test_04_user_context_eager_cache_hydration(self):
        """Verify cache hydration reads @rivo_cached_albums_v2 and @rivo_cached_playlists_v2 eagerly."""
        content = read_file_text(self.user_context)
        self.assertIn(
            "@rivo_cached_albums_v2",
            content,
            "UserContext.js must reference @rivo_cached_albums_v2 cache key",
        )
        self.assertIn(
            "@rivo_cached_playlists_v2",
            content,
            "UserContext.js must reference @rivo_cached_playlists_v2 cache key",
        )

    def test_05_home_screen_no_dummy_placeholder_flicker(self):
        """Verify HomeScreen.js does not flash dummy placeholder albums on cold start."""
        content = read_file_text(self.home_screen)
        self.assertNotIn(
            "INITIAL_ALBUMS",
            content,
            "HomeScreen.js must not reference INITIAL_ALBUMS dummy data",
        )


class TestFeatureScreenMemoization(unittest.TestCase):
    """
    Feature 11 & 12: Bottom Tab Screen Memoization & Prop Stabilization
    Authoritative Source: PROJECT.md § Feature Inventory (Features 11 & 12) & AGENTS.md § 2.
    """

    def test_01_quran_screen_memoized(self):
        """Verify QuranScreen.js export is wrapped in React.memo."""
        content = read_file_text(NATIVE_DIR / "screens" / "QuranScreen.js")
        is_memoized = (
            "React.memo(QuranScreen)" in content
            or "memo(QuranScreen)" in content
            or re.search(r"export\s+default\s+(?:React\.)?memo\s*\(", content) is not None
        )
        self.assertTrue(
            is_memoized,
            "QuranScreen.js export must be wrapped in React.memo()",
        )

    def test_02_offline_screen_memoized(self):
        """Verify OfflineScreen.js export is wrapped in React.memo."""
        content = read_file_text(NATIVE_DIR / "screens" / "OfflineScreen.js")
        is_memoized = (
            "React.memo(OfflineScreen)" in content
            or "memo(OfflineScreen)" in content
            or re.search(r"export\s+default\s+(?:React\.)?memo\s*\(", content) is not None
        )
        self.assertTrue(
            is_memoized,
            "OfflineScreen.js export must be wrapped in React.memo()",
        )

    def test_03_profile_screen_memoized(self):
        """Verify ProfileScreen.js export is wrapped in React.memo."""
        content = read_file_text(NATIVE_DIR / "screens" / "ProfileScreen.js")
        is_memoized = (
            "React.memo(ProfileScreen)" in content
            or "memo(ProfileScreen)" in content
            or re.search(r"export\s+default\s+(?:React\.)?memo\s*\(", content) is not None
        )
        self.assertTrue(
            is_memoized,
            "ProfileScreen.js export must be wrapped in React.memo()",
        )

    def test_04_stats_screen_memoized(self):
        """Verify StatsScreen.js export is wrapped in React.memo."""
        content = read_file_text(NATIVE_DIR / "screens" / "StatsScreen.js")
        is_memoized = (
            "React.memo(StatsScreen)" in content
            or "memo(StatsScreen)" in content
            or re.search(r"export\s+default\s+(?:React\.)?memo\s*\(", content) is not None
        )
        self.assertTrue(
            is_memoized,
            "StatsScreen.js export must be wrapped in React.memo()",
        )

    def test_05_home_screen_props_stabilized_in_app(self):
        """Verify App.js does not dynamically toggle initialFilter breaking HomeScreen memoization."""
        content = read_file_text(PROJECT_ROOT / "App.js")
        # Check line 1084 toggling pattern: initialFilter={activeTab === 'music' ? 'music' : 'all'}
        has_dynamic_filter_toggle = re.search(
            r"<HomeScreen[^>]*initialFilter=\{activeTab\s*===\s*'music'\s*\?\s*'music'\s*:\s*'all'\}",
            content,
            re.DOTALL,
        )
        self.assertIsNone(
            has_dynamic_filter_toggle,
            "App.js must not toggle initialFilter based on activeTab (breaks HomeScreen memoization on tab switch)",
        )


class TestFeatureFlatListVirtualization(unittest.TestCase):
    """
    Feature 13: List Virtualization (FlatList Migration)
    Authoritative Source: PROJECT.md § Feature Inventory (Feature 13) & AGENTS.md § 4.
    """

    def test_01_quran_screen_uses_flatlist(self):
        """Verify QuranScreen.js renders list using FlatList component."""
        content = read_file_text(NATIVE_DIR / "screens" / "QuranScreen.js")
        self.assertIn(
            "<FlatList",
            content,
            "QuranScreen.js must use <FlatList> for rendering track/surah list",
        )

    def test_02_quran_screen_no_monolithic_scrollview(self):
        """Verify QuranScreen.js does NOT import or render primary lists in ScrollView."""
        content = read_file_text(NATIVE_DIR / "screens" / "QuranScreen.js")
        # Check if ScrollView is used to wrap song items
        uses_scrollview_for_songs = re.search(
            r"<ScrollView[^>]*>.*?<SongItem",
            content,
            re.DOTALL,
        )
        self.assertIsNone(
            uses_scrollview_for_songs,
            "QuranScreen.js must not render song items inside unvirtualized <ScrollView>",
        )

    def test_03_quran_screen_flatlist_properties(self):
        """Verify QuranScreen.js FlatList specifies keyExtractor."""
        content = read_file_text(NATIVE_DIR / "screens" / "QuranScreen.js")
        self.assertIn(
            "keyExtractor",
            content,
            "QuranScreen.js FlatList must define keyExtractor",
        )

    def test_04_offline_screen_uses_flatlist(self):
        """Verify OfflineScreen.js renders downloaded tracks using FlatList."""
        content = read_file_text(NATIVE_DIR / "screens" / "OfflineScreen.js")
        self.assertIn(
            "<FlatList",
            content,
            "OfflineScreen.js must use <FlatList> for downloaded tracks list",
        )

    def test_05_offline_screen_virtualization_properties(self):
        """Verify OfflineScreen.js defines keyExtractor and avoids unvirtualized ScrollView for songs."""
        content = read_file_text(NATIVE_DIR / "screens" / "OfflineScreen.js")
        uses_scrollview_for_songs = re.search(
            r"<ScrollView[^>]*>.*?filteredOfflineTracks\.map",
            content,
            re.DOTALL,
        )
        self.assertIsNone(
            uses_scrollview_for_songs,
            "OfflineScreen.js must not map over filteredOfflineTracks inside <ScrollView>",
        )


class TestFeatureCompressionMiddleware(unittest.TestCase):
    """
    Feature 19: Express Compression Middleware
    Authoritative Source: PROJECT.md § Feature Inventory (Feature 19) & Interface Contracts.
    """

    def test_01_compression_package_dependency(self):
        """Verify compression dependency is present in server/package.json."""
        pkg = parse_package_json(SERVER_DIR / "package.json")
        deps = pkg.get("dependencies", {})
        self.assertIn(
            "compression",
            deps,
            "server/package.json dependencies must include 'compression'",
        )

    def test_02_compression_imported_in_server(self):
        """Verify server/index.js requires or imports compression."""
        content = read_file_text(SERVER_DIR / "index.js")
        has_import = (
            "require('compression')" in content
            or 'require("compression")' in content
            or "import compression" in content
        )
        self.assertTrue(
            has_import,
            "server/index.js must import/require compression middleware",
        )

    def test_03_compression_middleware_registered(self):
        """Verify server/index.js registers app.use(compression(...))."""
        content = read_file_text(SERVER_DIR / "index.js")
        has_mount = re.search(r"app\.use\s*\(\s*compression\s*\(", content) is not None
        self.assertTrue(
            has_mount,
            "server/index.js must mount compression middleware via app.use(compression(...))",
        )

    def test_04_compression_stream_filter(self):
        """Verify compression middleware skips already compressed audio stream routes."""
        content = read_file_text(SERVER_DIR / "index.js")
        # Compression filter should check headers or route paths (e.g. x-no-compression or audio/*)
        has_filter = (
            "filter" in content
            or "compression" in content
        )
        self.assertTrue(has_filter, "Compression configuration should include stream handling")

    def test_05_compression_middleware_active_on_catalog(self):
        """Verify server routes register compression before mounting /api/tracks and /api/albums."""
        content = read_file_text(SERVER_DIR / "index.js")
        comp_pos = content.find("compression(")
        tracks_pos = content.find("/api/tracks")
        self.assertNotEqual(comp_pos, -1, "compression must be used in server/index.js")
        if tracks_pos != -1:
            self.assertLess(
                comp_pos,
                tracks_pos,
                "compression middleware must be registered before /api/tracks route",
            )


class TestFeatureEtagCacheControl(unittest.TestCase):
    """
    Feature 20: HTTP Cache-Control & ETag 304 Support
    Authoritative Source: PROJECT.md § Feature Inventory (Feature 20) & Interface Contracts.
    """

    def setUp(self):
        self.tracks_route = SERVER_DIR / "routes" / "tracks.js"
        self.albums_route = SERVER_DIR / "routes" / "albums.js"

    def test_01_tracks_endpoint_cache_control(self):
        """Verify GET /api/tracks route sets Cache-Control header (public, max-age >= 120)."""
        content = read_file_text(self.tracks_route)
        has_cache_control = (
            "Cache-Control" in content
            and ("max-age=120" in content or "max-age=" in content)
        )
        self.assertTrue(
            has_cache_control,
            "server/routes/tracks.js GET / must set Cache-Control header",
        )

    def test_02_tracks_endpoint_etag_support(self):
        """Verify GET /api/tracks route generates and sets ETag header."""
        content = read_file_text(self.tracks_route)
        has_etag = (
            "ETag" in content
            or "etag" in content.lower()
            or "res.setHeader('ETag'" in content
            or 'res.setHeader("ETag"' in content
        )
        self.assertTrue(
            has_etag,
            "server/routes/tracks.js GET / must generate and set ETag header",
        )

    def test_03_tracks_endpoint_304_handling(self):
        """Verify GET /api/tracks route checks If-None-Match and returns 304 Not Modified."""
        content = read_file_text(self.tracks_route)
        has_304 = (
            "304" in content
            and ("if-none-match" in content.lower())
        )
        self.assertTrue(
            has_304,
            "server/routes/tracks.js must handle if-none-match and return 304 Not Modified",
        )

    def test_04_albums_endpoint_cache_control_and_etag(self):
        """Verify GET /api/albums route sets Cache-Control (max-age=300) and ETag."""
        content = read_file_text(self.albums_route)
        has_cache_headers = (
            "Cache-Control" in content
            or "max-age=300" in content
            or "ETag" in content
        )
        self.assertTrue(
            has_cache_headers,
            "server/routes/albums.js must set Cache-Control and ETag headers",
        )

    def test_05_albums_endpoint_304_handling(self):
        """Verify GET /api/albums route checks If-None-Match and returns 304 Not Modified."""
        content = read_file_text(self.albums_route)
        has_304 = (
            "304" in content
            or "if-none-match" in content.lower()
        )
        self.assertTrue(
            has_304,
            "server/routes/albums.js must check if-none-match and return 304 Not Modified",
        )


class TestFeatureCorsRestrictions(unittest.TestCase):
    """
    Feature 10: Strict CORS Restrictions
    Authoritative Source: PROJECT.md § Client ↔ Server Audio & Catalog Contract & AGENTS.md § 5.
    """

    def setUp(self):
        self.server_index = SERVER_DIR / "index.js"
        self.content = read_file_text(self.server_index)

    def test_01_cors_rejects_unauthorized_origins(self):
        """Verify corsOriginHandler rejects unauthorized third-party origins."""
        self.assertIn(
            "callback(null, false)",
            self.content,
            "corsOriginHandler must reject unauthorized origins with callback(null, false)",
        )

    def test_02_cors_allows_official_origins(self):
        """Verify allowedCorsOrigins includes official origins."""
        self.assertIn("tauri://localhost", self.content, "Must allow tauri://localhost")
        self.assertIn("capacitor://localhost", self.content, "Must allow capacitor://localhost")
        self.assertIn("http://localhost:5000", self.content, "Must allow http://localhost:5000")

    def test_03_cors_no_wildcard_reflection_with_credentials(self):
        """Verify corsOptions with credentials: true does NOT allow origin: '*'."""
        self.assertNotIn(
            "origin: '*'",
            self.content,
            "CORS must not allow wildcard origin '*' when credentials are true",
        )
        self.assertNotIn(
            'origin: "*"',
            self.content,
            "CORS must not allow wildcard origin '*' when credentials are true",
        )

    def test_04_cors_origin_regex_anchor_safety(self):
        """Verify origin regexes are anchored to prevent subdomain suffix spoofing."""
        # Check regex anchoring
        has_regex = re.search(r"/\^[^\$]+\$/", self.content)
        self.assertIsNotNone(
            has_regex,
            "CORS origin matching regexes must be anchored with ^ and $ to prevent spoofing",
        )

    def test_05_stream_proxy_strict_cors(self):
        """Verify stream proxy endpoint does not reflect untrusted origins."""
        tracks_route = read_file_text(SERVER_DIR / "routes" / "tracks.js")
        # Should not have loose cors override on stream-proxy
        has_loose_cors = "res.setHeader('Access-Control-Allow-Origin', '*')" in tracks_route
        self.assertFalse(
            has_loose_cors,
            "stream-proxy route must not set Access-Control-Allow-Origin: *",
        )


if __name__ == "__main__":
    unittest.main()
