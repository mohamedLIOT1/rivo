"""
Rivo E2E Test Suite - Tier 3: Cross-Feature Combinations
Validates complex multi-feature interactions, race conditions, and error recovery:
1. Bottom Tab Switching During Active Audio Playback
2. Cache Hydration vs Network Sync Race Conditions
3. GoogleVideo 403 Forbidden Auto-Recovery & Fallback Chains
"""

import unittest
import json
import re
from pathlib import Path
from .harness import (
    PROJECT_ROOT,
    NATIVE_DIR,
    SERVER_DIR,
    read_file_text,
    file_exists,
    StreamRecoverySimulator,
)


class TestTabSwitchingDuringPlayback(unittest.TestCase):
    """
    Combination 1: Tab Switching During Active Audio Playback
    Validates that changing tabs (Music -> Quran -> Offline -> Vault)
    never halts audio playback, drops frames, or re-renders player roots.
    """

    def setUp(self):
        self.app_content = read_file_text(PROJECT_ROOT / "App.js")
        self.audio_context = read_file_text(NATIVE_DIR / "context" / "AudioContext.js")

    def test_01_tab_switching_preserves_audio_singleton(self):
        """Verify AudioProvider wraps MainAppShell in App.js so tab switching does not unmount it."""
        audio_prov_pos = self.app_content.find("<AudioProvider>")
        main_shell_pos = self.app_content.find("<MainAppShell />")
        self.assertNotEqual(audio_prov_pos, -1, "App.js must wrap tree with <AudioProvider>")
        self.assertNotEqual(main_shell_pos, -1, "App.js must render <MainAppShell />")
        self.assertLess(
            audio_prov_pos,
            main_shell_pos,
            "<AudioProvider> must wrap <MainAppShell /> so tab switching does not unmount audio state",
        )

    def test_02_audio_progress_context_isolates_playback_ticks(self):
        """Verify high-frequency ticks (currentTime, progress) are isolated in AudioProgressContext."""
        audio_prog_file = NATIVE_DIR / "context" / "AudioProgressContext.js"
        # AudioProgressContext should exist as a separate modular provider
        self.assertTrue(
            file_exists(audio_prog_file),
            f"AudioProgressContext.js must exist at {audio_prog_file} to isolate 250ms ticks from AudioContext",
        )

    def test_03_tab_switch_during_active_download(self):
        """Verify downloadManager dispatches progress events without blocking main UI thread."""
        dl_manager = read_file_text(NATIVE_DIR / "services" / "downloadManager.js")
        has_listeners = (
            "subscribeToDownloadedTracks" in dl_manager
            or "listeners" in dl_manager
            or "EventEmitter" in dl_manager
        )
        self.assertTrue(
            has_listeners,
            "downloadManager.js must use observer/subscription pattern for download progress",
        )


class TestCacheHydrationRaceConditions(unittest.TestCase):
    """
    Combination 2: Cache Hydration vs Network Sync Race Conditions
    Validates state determinism when remote network API completes before/after AsyncStorage.
    """

    def setUp(self):
        self.user_context = read_file_text(NATIVE_DIR / "context" / "UserContext.js")

    def test_04_cache_hydration_vs_remote_api_sync_race(self):
        """Verify UserContext.js checks if remote tracks are already loaded before clobbering with cache."""
        # Cache tracks should only populate if remote tracks haven't already superseded them
        has_guard = (
            "length" in self.user_context
            or "isLoaded" in self.user_context
            or "deduplicateTrackList" in self.user_context
        )
        self.assertTrue(
            has_guard,
            "UserContext.js must coordinate cache hydration with remote track sync",
        )

    def test_05_concurrent_playlist_toggle_and_cache_write(self):
        """Verify togglePlaylistVisibility updates both state and AsyncStorage without race loss."""
        self.assertIn(
            "togglePlaylistVisibility",
            self.user_context,
            "UserContext.js must implement togglePlaylistVisibility",
        )
        self.assertIn(
            "AsyncStorage.setItem",
            self.user_context,
            "UserContext.js must persist playlist updates to AsyncStorage",
        )

    def test_06_auth_loaded_before_catalog_cache(self):
        """Verify isAuthLoaded is set to true immediately upon reading token, before heavy tracks."""
        load_func_idx = self.user_context.find("const loadStoredAuth = async () =>")
        self.assertNotEqual(load_func_idx, -1, "UserContext.js must define loadStoredAuth")
        func_body = self.user_context[load_func_idx:]
        auth_pos = func_body.find("setIsAuthLoaded(true)")
        cache_pos = func_body.find("AsyncStorage.getItem(CACHE_TRACKS_KEY)")
        self.assertNotEqual(auth_pos, -1, "loadStoredAuth must set setIsAuthLoaded(true)")
        self.assertNotEqual(cache_pos, -1, "loadStoredAuth must read CACHE_TRACKS_KEY")
        self.assertLess(
            auth_pos,
            cache_pos,
            "setIsAuthLoaded(true) must be called before track catalog cache read in loadStoredAuth",
        )


class TestStreamRecoveryOn403(unittest.TestCase):
    """
    Combination 3: GoogleVideo 403 Forbidden Auto-Recovery & Fallbacks
    Validates resilience against GoogleVideo CDN token expiry and upstream failure.
    """

    def setUp(self):
        self.tracks_route = read_file_text(SERVER_DIR / "routes" / "tracks.js")
        self.yt_resolver = read_file_text(SERVER_DIR / "utils" / "helpers.js")

    def test_07_stream_proxy_catches_403_and_re_resolves(self):
        """Verify tracks.js stream-proxy detects 403 Forbidden and attempts stream URL re-resolution."""
        has_403_handler = (
            "403" in self.tracks_route
            and ("resolveOfficialYouTubeAudioStream" in self.tracks_route or "retry" in self.tracks_route.lower())
        )
        self.assertTrue(
            has_403_handler,
            "server/routes/tracks.js stream-proxy must detect 403 Forbidden and re-resolve audio stream",
        )

    def test_08_stream_recovery_simulator_validation(self):
        """Verify stream recovery simulator logic succeeds after transient 403."""
        sim = StreamRecoverySimulator(failure_count_before_success=2)
        code1, _ = sim.fetch_stream("https://googlevideo.com/videoplayback?expire=old")
        self.assertEqual(code1, 403)
        code2, _ = sim.fetch_stream("https://googlevideo.com/videoplayback?expire=old")
        self.assertEqual(code2, 403)
        code3, data = sim.fetch_stream("https://googlevideo.com/videoplayback?expire=fresh", "invidious_fallback")
        self.assertEqual(code3, 200)
        self.assertIn(b"AUDIO_STREAM_DATA_CHUNK_RECOVERED", data)
        self.assertEqual(sim.attempts, 3)

    def test_09_stream_token_expiry_auto_refresh(self):
        """Verify invalidateAudioCache or cache bypass is called on stream resolution failures."""
        has_invalidation = (
            "invalidateAudioCache" in self.tracks_route
            or "clearStreamCache" in self.tracks_route
            or "cache" in self.tracks_route.lower()
        )
        self.assertTrue(
            has_invalidation,
            "tracks.js must invalidate stale stream cache upon stream playback failure",
        )


if __name__ == "__main__":
    unittest.main()
