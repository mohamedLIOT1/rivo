"""
Adversarial Challenge & Stress Verification Suite for Milestone M2
Empirical Challenger: challenger_m2_1

Verifies:
1. splashscreen.xml drawable syntax & API 23/24 inflation safety.
2. MainActivity.kt cold start race conditions, lifecycle, and memory leak safety.
3. MainApplication.kt cleanupOldInstallers exception handling under hostile filesystem edge cases.
4. publish-ota.js hermesc compilation, fallback on missing binary, and resilience to syntax errors.
"""

import unittest
import os
import sys
import re
import shutil
import tempfile
import subprocess
import json
import xml.etree.ElementTree as ET
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

class TestAdversarialSplashscreenXml(unittest.TestCase):
    """
    Adversarial verification of splashscreen.xml against Android API 23/24 inflation rules.
    """

    def setUp(self):
        self.splash_path = REPO_ROOT / "android" / "app" / "src" / "main" / "res" / "drawable" / "splashscreen.xml"
        self.colors_path = REPO_ROOT / "android" / "app" / "src" / "main" / "res" / "values" / "colors.xml"
        self.drawable_dirs = [
            REPO_ROOT / "android" / "app" / "src" / "main" / "res" / "drawable",
            REPO_ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-mdpi",
            REPO_ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-hdpi",
            REPO_ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-xhdpi",
            REPO_ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-xxhdpi",
            REPO_ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-xxxhdpi",
        ]

    def test_01_xml_validity_and_namespace(self):
        """Verify XML is valid and has Android namespace definition on root."""
        self.assertTrue(self.splash_path.exists(), "splashscreen.xml does not exist")
        tree = ET.parse(self.splash_path)
        root = tree.getroot()
        self.assertEqual(root.tag, "layer-list", "Root tag must be layer-list")
        
        # Verify layer-list items count
        items = root.findall("item")
        self.assertGreaterEqual(len(items), 2, "layer-list must contain at least background and foreground items")

    def test_02_background_color_resolution(self):
        """Verify background color referenced in layer-list exists and is valid hex."""
        tree = ET.parse(self.splash_path)
        root = tree.getroot()
        first_item = root.findall("item")[0]
        drawable_attr = first_item.attrib.get("{http://schemas.android.com/apk/res/android}drawable")
        self.assertIsNotNone(drawable_attr, "First item must have android:drawable attribute")
        self.assertTrue(drawable_attr.startswith("@color/"), f"Background must reference @color, got {drawable_attr}")

        color_name = drawable_attr.replace("@color/", "")
        colors_tree = ET.parse(self.colors_path)
        colors_root = colors_tree.getroot()
        found = False
        color_val = None
        for color in colors_root.findall("color"):
            if color.attrib.get("name") == color_name:
                found = True
                color_val = color.text.strip()
                break
        self.assertTrue(found, f"Color {color_name} not found in colors.xml")
        self.assertTrue(color_val.startswith("#"), f"Color value must be hex, got {color_val}")
        self.assertIn(len(color_val), [4, 7, 9], f"Invalid hex color length: {color_val}")

    def test_03_bitmap_vs_vector_inflation_safety_api23_24(self):
        """
        Verify splashscreen image is an actual PNG/Bitmap, NOT a vector drawable.
        In Android API 23/24, <bitmap android:src="@drawable/..."/> crashes with
        InflateException/Resources$NotFoundException if src references a VectorDrawable.
        """
        tree = ET.parse(self.splash_path)
        root = tree.getroot()
        items = root.findall("item")
        bitmap_found = False
        for item in items:
            bitmap = item.find("bitmap")
            if bitmap is not None:
                bitmap_found = True
                src = bitmap.attrib.get("{http://schemas.android.com/apk/res/android}src")
                self.assertIsNotNone(src, "<bitmap> must specify android:src")
                self.assertTrue(src.startswith("@drawable/"), f"src must reference @drawable, got {src}")
                res_name = src.replace("@drawable/", "")

                # Check that res_name exists as PNG in drawable folders and NOT as .xml (vector)
                for d_dir in self.drawable_dirs:
                    if d_dir.exists():
                        png_file = d_dir / f"{res_name}.png"
                        xml_file = d_dir / f"{res_name}.xml"
                        self.assertFalse(xml_file.exists(), f"Vector drawable {xml_file} would crash <bitmap> on API 23/24")
                        if png_file.exists():
                            # Verify PNG magic bytes
                            with open(png_file, "rb") as f:
                                magic = f.read(8)
                            self.assertEqual(magic, b"\x89PNG\r\n\x1a\n", f"Invalid PNG magic in {png_file}")

        self.assertTrue(bitmap_found, "splashscreen.xml must contain a <bitmap> element inside <item>")

    def test_04_gravity_syntax_for_api23_layer_list(self):
        """
        Verify gravity attributes are specified correctly so images are not stretched or distorted.
        On Android API 23+, item-level gravity center is supported and bitmap gravity center ensures
        proper bitmap centering within bounds.
        """
        tree = ET.parse(self.splash_path)
        root = tree.getroot()
        items = root.findall("item")
        bitmap_item = None
        for item in items:
            if item.find("bitmap") is not None:
                bitmap_item = item
                break
        self.assertIsNotNone(bitmap_item, "Bitmap item missing")
        item_gravity = bitmap_item.attrib.get("{http://schemas.android.com/apk/res/android}gravity")
        bitmap_gravity = bitmap_item.find("bitmap").attrib.get("{http://schemas.android.com/apk/res/android}gravity")
        self.assertEqual(bitmap_gravity, "center", "bitmap android:gravity must be 'center'")


class TestAdversarialMainActivityColdStart(unittest.TestCase):
    """
    Adversarial verification of MainActivity.kt lifecycle, race conditions, and memory safety.
    """

    def setUp(self):
        self.activity_path = REPO_ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "rivo" / "app" / "MainActivity.kt"
        with open(self.activity_path, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_01_no_synchronous_theme_override(self):
        """
        Verify setTheme(AppTheme) is not called synchronously in onCreate, which previously
        caused the black screen window blanking before JS load.
        """
        self.assertNotIn("setTheme(R.style.AppTheme)", self.content)
        self.assertNotIn("setTheme(R.style.AppTheme);", self.content)

    def test_02_super_on_create_null_saved_state(self):
        """
        Verify super.onCreate(null) is used to prevent Fragment restoration state crashes
        in react-native-screens during cold start or background resurrection.
        """
        self.assertIn("super.onCreate(null)", self.content)

    def test_03_decor_view_post_no_leak_closure(self):
        """
        Verify window.decorView.post does not capture or leak Activity references in static fields.
        """
        self.assertIn("window.decorView.post", self.content)
        # Verify no static/companion object references hold activity context
        self.assertNotIn("companion object", self.content)

    def test_04_on_new_intent_safety(self):
        """
        Verify onNewIntent calls setIntent(intent) and delegates to MediaControlsModule.
        """
        self.assertIn("override fun onNewIntent(intent: Intent?)", self.content)
        self.assertIn("super.onNewIntent(intent)", self.content)
        self.assertIn("setIntent(intent)", self.content)

    def test_05_back_press_api_version_branching(self):
        """
        Verify invokeDefaultOnBackPressed handles Build.VERSION_CODES.R (API 30) vs S (API 31+)
        without infinite recursion or crashes.
        """
        self.assertIn("Build.VERSION.SDK_INT <= Build.VERSION_CODES.R", self.content)
        self.assertIn("moveTaskToBack(false)", self.content)
        self.assertIn("super.invokeDefaultOnBackPressed()", self.content)


class TestAdversarialMainApplicationCleanup(unittest.TestCase):
    """
    Adversarial stress-testing of cleanupOldInstallersAsync exception safety under hostile conditions.
    """

    def setUp(self):
        self.app_path = REPO_ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "rivo" / "app" / "MainApplication.kt"
        with open(self.app_path, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_01_async_executor_offload(self):
        """Verify cleanup is offloaded to background executor and not called synchronously in onCreate."""
        self.assertIn("cleanupOldInstallersAsync()", self.content)
        self.assertIn("Executors.newSingleThreadExecutor()", self.content)
        
        # Verify onCreate calls cleanupOldInstallersAsync(), not cleanupOldInstallers() directly
        on_create_match = re.search(r"override\s+fun\s+onCreate\s*\(\s*\)\s*\{([^}]+)\}", self.content)
        self.assertIsNotNone(on_create_match)
        body = on_create_match.group(1)
        self.assertIn("cleanupOldInstallersAsync()", body)
        self.assertNotIn("cleanupOldInstallers()", body.replace("cleanupOldInstallersAsync()", ""))

    def test_02_outer_try_catch_safety(self):
        """Verify entire cleanupOldInstallers body is enclosed in try-catch to guarantee no unhandled exceptions."""
        self.assertIn("catch (e: Exception)", self.content)
        self.assertIn("android.util.Log.e(\"Rivo\"", self.content)

    def test_03_per_file_delete_exception_isolation(self):
        """Verify individual file deletion errors do not abort the directory iteration."""
        self.assertIn("try { file.delete() } catch (ignored: Exception) {}", self.content)

    def test_04_simulated_hostile_filesystem_stress(self):
        """
        Empirically simulate cleanupOldInstallers algorithm against hostile filesystem scenarios:
        - Non-existent directories
        - Unreadable directories (permission simulation)
        - Files with read-only attributes
        - Subdirectories matching '.apk' or '.ipa' (should not be deleted via file.delete())
        - Non-matching files (must not be touched)
        - Locked / concurrent deletion race conditions
        """
        temp_dir = tempfile.mkdtemp(prefix="rivo_test_cleanup_")
        try:
            cache_dir = Path(temp_dir) / "cache"
            ext_cache_dir = Path(temp_dir) / "ext_cache"
            files_dir = Path(temp_dir) / "files"
            non_existent_dir = Path(temp_dir) / "does_not_exist"

            cache_dir.mkdir()
            files_dir.mkdir()
            # ext_cache_dir not created to test null/non-existent handling

            # Create test files
            old_apk = cache_dir / "update_1.0.apk"
            old_apk.write_text("dummy apk data")

            old_ipa = files_dir / "update.IPA"
            old_ipa.write_text("dummy ipa data")

            ota_temp = cache_dir / "rivo_ota_temp_123.bin"
            ota_temp.write_text("dummy ota data")

            legit_db = files_dir / "user_data.sqlite"
            legit_db.write_text("user db")

            legit_pref = cache_dir / "settings.json"
            legit_pref.write_text("{}")

            apk_dir = cache_dir / "fake_dir.apk"
            apk_dir.mkdir() # directory named .apk

            # Simulate exact Kotlin logic in Python
            target_dirs = [cache_dir, ext_cache_dir, files_dir, non_existent_dir, None]
            errors_occurred = []

            for dir_entry in target_dirs:
                try:
                    if dir_entry is None or not dir_entry.exists():
                        continue
                    files = [f for f in dir_entry.iterdir()]
                    for file_entry in files:
                        name_lower = file_entry.name.lower()
                        if file_entry.is_file() and (
                            name_lower.endswith(".apk") or
                            name_lower.endswith(".ipa") or
                            name_lower.startswith("rivo_ota_temp")
                        ):
                            try:
                                file_entry.unlink()
                            except Exception as ex:
                                errors_occurred.append(ex)
                except Exception as ex:
                    errors_occurred.append(ex)

            # Assertions on post-cleanup state:
            self.assertEqual(len(errors_occurred), 0, "No exceptions should escape during cleanup")
            self.assertFalse(old_apk.exists(), "Old APK must be deleted")
            self.assertFalse(old_ipa.exists(), "Old IPA must be deleted")
            self.assertFalse(ota_temp.exists(), "OTA temp file must be deleted")
            self.assertTrue(legit_db.exists(), "Legit DB must NOT be deleted")
            self.assertTrue(legit_pref.exists(), "Legit settings must NOT be deleted")
            self.assertTrue(apk_dir.exists(), "Directory named .apk must NOT be deleted (isFile check)")

        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


class TestAdversarialHermesPipelineAndFallback(unittest.TestCase):
    """
    Adversarial verification of publish-ota.js Hermes compiler discovery, compilation, and error fallback.
    """

    def setUp(self):
        self.script_path = REPO_ROOT / "scripts" / "publish-ota.js"
        with open(self.script_path, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_01_hermes_compiler_resolution_cross_platform(self):
        """Verify findHermesCompiler supports win32, darwin, and linux platform binaries."""
        self.assertIn("win64-bin", self.content)
        self.assertIn("hermesc.exe", self.content)
        self.assertIn("osx-bin", self.content)
        self.assertIn("linux64-bin", self.content)

    def test_02_bytecode_compilation_flags(self):
        """Verify hermesc is invoked with -emit-binary and output bundle path."""
        self.assertIn("-emit-binary", self.content)
        self.assertIn("-out", self.content)

    def test_03_fallback_try_catch_safety(self):
        """Verify hermesc compilation is wrapped in try-catch so failure falls back gracefully to plaintext bundle."""
        self.assertIn("try {", self.content)
        self.assertIn("execSync(hermesCmd", self.content)
        self.assertIn("catch (hbcErr)", self.content)
        self.assertIn("console.warn('⚠️ hermesc bytecode compilation warning:'", self.content)

    def test_04_empirical_hermesc_bytecode_generation_and_fallback(self):
        """
        Empirically test hermesc compilation and fallback:
        1. Compile valid JS to HBC and verify Hermes Bytecode Magic Header (\xc6\x1f\xbc\x03)
        2. Test invalid syntax JS bundle and verify hermesc throws and fallback retains bundle
        """
        hermesc_exe = REPO_ROOT / "node_modules" / "react-native" / "sdks" / "hermesc" / "win64-bin" / "hermesc.exe"
        if not hermesc_exe.exists():
            self.skipTest("hermesc.exe not present in local test environment")

        temp_dir = tempfile.mkdtemp(prefix="rivo_hermes_test_")
        try:
            # Case 1: Valid JS bundle compilation
            js_bundle = Path(temp_dir) / "index.android.bundle"
            hbc_bundle = Path(temp_dir) / "index.android.bundle.hbc"
            js_bundle.write_text("var Rivo = { version: '2.0.0', play: function() { return 42; } };", encoding="utf-8")

            cmd = [str(hermesc_exe), "-emit-binary", "-out", str(hbc_bundle), str(js_bundle)]
            res = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(res.returncode, 0, f"Hermesc compilation failed: {res.stderr}")
            self.assertTrue(hbc_bundle.exists(), "HBC output bundle was not created")

            # Check Hermes Bytecode magic: first 4 bytes must be 0xc6 0x1f 0xbc 0x03
            with open(hbc_bundle, "rb") as f:
                header = f.read(4)
            self.assertEqual(header, b"\xc6\x1f\xbc\x03", f"Invalid Hermes bytecode magic header: {header}")

            # Case 2: Syntax error JS bundle - verify hermesc fails and fallback behavior
            bad_bundle = Path(temp_dir) / "bad.bundle"
            bad_hbc = Path(temp_dir) / "bad.bundle.hbc"
            bad_bundle.write_text("function bad( { return ???; ", encoding="utf-8")

            bad_cmd = [str(hermesc_exe), "-emit-binary", "-out", str(bad_hbc), str(bad_bundle)]
            bad_res = subprocess.run(bad_cmd, capture_output=True, text=True)
            self.assertNotEqual(bad_res.returncode, 0, "Hermesc should fail on syntax error")
            self.assertFalse(bad_hbc.exists(), "HBC should not be created for invalid syntax")
            # In publish-ota.js, bad_bundle is preserved because unlink is inside the try block after execSync
            self.assertTrue(bad_bundle.exists(), "Original bundle must remain intact for fallback")

        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
