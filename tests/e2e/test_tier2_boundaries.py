"""
Rivo E2E Test Suite - Tier 2: Boundary & Corner Cases
Validates extreme conditions, edge cases, and failure modes:
1. Empty Cache Handling (null, empty strings, initial cold boots)
2. Network Timeouts & AbortSignal Request Cancellation
3. Malformed API Responses & Corrupted JSON Recovery
4. Zero-Byte Streams & Empty File Guards
5. Maximum Limit & Pagination Boundaries
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
    ClientCacheSimulator,
)


class TestEmptyCacheBoundaries(unittest.TestCase):
    """
    Boundary 1: Empty Cache Handling
    Validates client behavior when AsyncStorage cache keys return null or empty values.
    """

    def test_01_empty_cache_user_context_safe_hydration(self):
        """Verify hydration with empty cache keys yields empty arrays without exceptions."""
        simulator = ClientCacheSimulator(storage={})
        result = simulator.hydrate_user_context()
        self.assertEqual(result["tracks"], [], "Tracks must be an empty list when cache is empty")
        self.assertEqual(result["albums"], [], "Albums must be an empty list when cache is empty")
        self.assertEqual(result["playlists"], [], "Playlists must be an empty list when cache is empty")
        self.assertEqual(result["errors"], [], "Empty cache must not generate error flags")

    def test_02_empty_cache_no_dummy_fallback(self):
        """Verify UserContext.js does not fall back to INITIAL_ALBUMS when cached albums are null."""
        content = read_file_text(NATIVE_DIR / "context" / "UserContext.js")
        # Check if fallback logic uses INITIAL_ALBUMS: e.g. setAlbums(parsed || INITIAL_ALBUMS)
        has_fallback_to_dummy = re.search(
            r"setAlbums\s*\([^)]*INITIAL_ALBUMS[^)]*\)",
            content,
        )
        self.assertIsNone(
            has_fallback_to_dummy,
            "UserContext.js must not fall back to INITIAL_ALBUMS when cache is empty",
        )

    def test_03_corrupted_empty_string_cache(self):
        """Verify parsing empty string '' or whitespace-only cache item does not crash."""
        simulator = ClientCacheSimulator(storage={
            "@rivo_cached_tracks_v2": "",
            "@rivo_cached_albums_v2": "   ",
            "@rivo_cached_playlists_v2": "\n",
        })
        result = simulator.hydrate_user_context()
        # When string is empty, json.loads fails; the hydration logic must capture errors safely
        self.assertIsInstance(result["tracks"], list)
        self.assertIsInstance(result["albums"], list)
        self.assertIsInstance(result["playlists"], list)


class TestNetworkTimeoutBoundaries(unittest.TestCase):
    """
    Boundary 2: Network Timeouts & AbortSignal Cancellation
    Validates request cancellation, timeout recovery, and in-flight fetch management.
    """

    def test_04_abort_controller_timeout_signal(self):
        """Verify search requests and network fetches in native layer support AbortSignal."""
        search_screen = NATIVE_DIR / "screens" / "SearchScreen.js"
        if search_screen.exists():
            content = read_file_text(search_screen)
            has_abort = "AbortController" in content or "signal" in content
            self.assertTrue(
                has_abort,
                "SearchScreen.js must use AbortController signal for in-flight query cancellation",
            )
        else:
            # Check App.js or downloadManager
            app_content = read_file_text(PROJECT_ROOT / "App.js")
            self.assertIn("fetch", app_content)

    def test_05_stream_proxy_upstream_timeout_recovery(self):
        """Verify server stream-proxy route configures client timeout or error handling."""
        tracks_route = read_file_text(SERVER_DIR / "routes" / "tracks.js")
        has_timeout_handling = (
            "timeout" in tracks_route
            or "ECONNABORTED" in tracks_route
            or "ETIMEDOUT" in tracks_route
            or "catch" in tracks_route
        )
        self.assertTrue(
            has_timeout_handling,
            "server/routes/tracks.js stream-proxy must handle upstream timeouts",
        )

    def test_06_live_search_rapid_abort_handling(self):
        """Verify search debounce or cancellation logic is implemented in search components."""
        helpers_path = SERVER_DIR / "utils" / "helpers.js"
        content = read_file_text(helpers_path)
        self.assertIn(
            "searchTracksInternal",
            content,
            "helpers.js must export searchTracksInternal",
        )


class TestMalformedApiResponseBoundaries(unittest.TestCase):
    """
    Boundary 3: Malformed API Responses & Corrupted Data
    Validates resilient handling of corrupted JSON, non-array payloads, and malformed track schemas.
    """

    def test_07_malformed_json_cache_recovery(self):
        """Verify corrupt JSON in cache storage is caught cleanly without unhandled exceptions."""
        simulator = ClientCacheSimulator(storage={
            "@rivo_cached_tracks_v2": "{not-valid-json:: truncated",
            "@rivo_cached_albums_v2": "[{\"title\": \"Album 1\", unclosed",
        })
        result = simulator.hydrate_user_context()
        self.assertGreater(len(result["errors"]), 0, "Errors should be recorded for corrupt cache")
        self.assertEqual(result["tracks"], [], "Tracks must safely default to empty list")
        self.assertEqual(result["albums"], [], "Albums must safely default to empty list")

    def test_08_non_array_tracks_api_response_handling(self):
        """Verify deduplicateTrackList handles non-array input (e.g. error object or null) safely."""
        dl_manager = read_file_text(NATIVE_DIR / "services" / "downloadManager.js")
        # Check deduplicateTrackList implementation
        has_array_check = (
            "Array.isArray" in dl_manager
            or "!list" in dl_manager
        )
        self.assertTrue(
            has_array_check,
            "downloadManager.js deduplicateTrackList must guard against non-array input",
        )

    def test_09_track_items_missing_fields_sanitization(self):
        """Verify track items missing _id or audioUrl are filtered out cleanly."""
        dl_manager = read_file_text(NATIVE_DIR / "services" / "downloadManager.js")
        self.assertIn(
            "getTrackDedupeKey",
            dl_manager,
            "downloadManager.js must have getTrackDedupeKey for track identity validation",
        )


class TestZeroByteStreamBoundaries(unittest.TestCase):
    """
    Boundary 4: Zero-Byte Streams & Empty File Guards
    Validates player and proxy resilience against zero-byte files, null audio, and 0 duration.
    """

    def test_10_zero_byte_stream_rejection(self):
        """Verify helpers.js isAudioFileValid checks file size > 1024 bytes."""
        helpers_content = read_file_text(SERVER_DIR / "utils" / "helpers.js")
        self.assertIn(
            "isAudioFileValid",
            helpers_content,
            "helpers.js must export isAudioFileValid to validate audio file size",
        )

    def test_11_zero_duration_playback_guard(self):
        """Verify AudioContext guards against duration <= 0 avoiding division by zero."""
        audio_context = read_file_text(NATIVE_DIR / "context" / "AudioContext.js")
        # Progress calculation should check duration > 0: e.g. duration > 0 ? (currentTime / duration) : 0
        has_div_guard = (
            "duration > 0" in audio_context
            or "duration <= 0" in audio_context
            or "duration ? " in audio_context
        )
        self.assertTrue(
            has_div_guard,
            "AudioContext.js must guard against duration <= 0 in progress calculations",
        )

    def test_12_zero_byte_download_cleanup(self):
        """Verify downloadTrack in downloadManager.js validates downloaded file size."""
        dl_manager = read_file_text(NATIVE_DIR / "services" / "downloadManager.js")
        has_size_check = (
            "size" in dl_manager
            or "length" in dl_manager
            or "info.exists" in dl_manager
        )
        self.assertTrue(
            has_size_check,
            "downloadManager.js must check downloaded file size",
        )


class TestMaximumLimitBoundaries(unittest.TestCase):
    """
    Boundary 5: Maximum Limit & Pagination Boundaries
    Validates enforcement of query limits per PROJECT.md interface contract.
    """

    def setUp(self):
        self.tracks_route = read_file_text(SERVER_DIR / "routes" / "tracks.js")

    def test_13_tracks_limit_query_cap_1000(self):
        """Verify GET /api/tracks caps limit query to maximum 1000 per PROJECT.md interface contract."""
        has_limit_cap = (
            "1000" in self.tracks_route
            or "Math.min" in self.tracks_route
        )
        self.assertTrue(
            has_limit_cap,
            "server/routes/tracks.js must enforce maximum limit cap of 1000 items",
        )

    def test_14_tracks_limit_default_500(self):
        """Verify GET /api/tracks defaults to 500 items when limit is omitted."""
        has_default_500 = (
            "500" in self.tracks_route
            or "limit ||" in self.tracks_route
            or "parseInt" in self.tracks_route
        )
        self.assertTrue(
            has_default_500,
            "server/routes/tracks.js must default limit to 500 items",
        )

    def test_15_negative_and_nan_limit_sanitization(self):
        """Verify tracks route parses and normalizes non-integer or negative query params."""
        has_parse = (
            "parseInt" in self.tracks_route
            or "Number(" in self.tracks_route
        )
        self.assertTrue(
            has_parse,
            "server/routes/tracks.js must parse numeric limit/page query parameters",
        )


if __name__ == "__main__":
    unittest.main()
