"""
Rivo E2E Test Suite - Shared Test Harness and Utilities
Provides file system resolvers, AST/regex analyzers, mock environments,
and benchmark calculators for Tiers 1-4.
"""

import os
import re
import json
import gzip
import time
import socket
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# Base repository paths
TESTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TESTS_DIR.parent.parent
NATIVE_DIR = PROJECT_ROOT / "src" / "native"
SERVER_DIR = PROJECT_ROOT / "server"
ANDROID_DIR = PROJECT_ROOT / "android"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"


def read_file_text(path: Path) -> str:
    """Read file content safely as UTF-8 string."""
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    return path.read_text(encoding="utf-8", errors="replace")


def file_exists(path: Path) -> bool:
    """Check if file exists."""
    return path.exists()


def parse_xml_file(path: Path) -> ET.Element:
    """Parse an XML file safely."""
    if not path.exists():
        raise FileNotFoundError(f"XML file not found: {path}")
    tree = ET.parse(path)
    return tree.getroot()


def parse_package_json(path: Path) -> Dict[str, Any]:
    """Parse a package.json file."""
    content = read_file_text(path)
    return json.loads(content)


def find_free_port() -> int:
    """Find an available ephemeral TCP port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class ClientCacheSimulator:
    """
    Simulates React Native AsyncStorage cache hydration behavior
    for testing boundary conditions, race conditions, and corrupted storage.
    """

    def __init__(self, storage: Optional[Dict[str, str]] = None):
        self.storage = storage or {}
        self.hydrate_history: List[str] = []

    def get_item(self, key: str) -> Optional[str]:
        self.hydrate_history.append(f"GET:{key}")
        return self.storage.get(key)

    def set_item(self, key: str, value: str):
        self.hydrate_history.append(f"SET:{key}")
        self.storage[key] = value

    def hydrate_user_context(self) -> Dict[str, Any]:
        """
        Simulate UserContext hydration logic adhering to R5 specification:
        - Must not use dummy placeholders (INITIAL_TRACKS / INITIAL_ALBUMS).
        - Must gracefully handle null, empty, or corrupted cache.
        """
        tracks_raw = self.get_item("@rivo_cached_tracks_v2")
        albums_raw = self.get_item("@rivo_cached_albums_v2")
        playlists_raw = self.get_item("@rivo_cached_playlists_v2")

        result = {
            "tracks": [],
            "albums": [],
            "playlists": [],
            "errors": [],
            "hydrated_immediately": True,
        }

        # Parse albums
        if albums_raw is not None:
            try:
                parsed_albums = json.loads(albums_raw)
                if isinstance(parsed_albums, list):
                    result["albums"] = parsed_albums
                else:
                    result["errors"].append("albums_not_a_list")
            except Exception as e:
                result["errors"].append(f"albums_json_corrupted:{str(e)}")

        # Parse playlists
        if playlists_raw is not None:
            try:
                parsed_pl = json.loads(playlists_raw)
                if isinstance(parsed_pl, list):
                    result["playlists"] = parsed_pl
                else:
                    result["errors"].append("playlists_not_a_list")
            except Exception as e:
                result["errors"].append(f"playlists_json_corrupted:{str(e)}")

        # Parse tracks
        if tracks_raw is not None:
            try:
                parsed_tr = json.loads(tracks_raw)
                if isinstance(parsed_tr, list):
                    result["tracks"] = [t for t in parsed_tr if t and isinstance(t, dict)]
                else:
                    result["errors"].append("tracks_not_a_list")
            except Exception as e:
                result["errors"].append(f"tracks_json_corrupted:{str(e)}")

        return result


class StreamRecoverySimulator:
    """
    Simulates GoogleVideo 403 Forbidden stream recovery mechanism
    for audio streaming proxy resilience testing.
    """

    def __init__(self, failure_count_before_success: int = 1):
        self.failure_count = failure_count_before_success
        self.attempts = 0
        self.providers_queried: List[str] = []

    def fetch_stream(self, url: str, provider: str = "primary_youtube") -> Tuple[int, bytes]:
        self.attempts += 1
        self.providers_queried.append(provider)

        if self.attempts <= self.failure_count:
            # Simulate GoogleVideo 403 token expiry
            return 403, b"Forbidden: GoogleVideo token expired"

        # Recovered
        return 200, b"AUDIO_STREAM_DATA_CHUNK_RECOVERED"
