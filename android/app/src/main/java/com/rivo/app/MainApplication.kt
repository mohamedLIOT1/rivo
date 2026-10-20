package com.rivo.app

import android.app.Application
import android.content.Context
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
        this,
        object : DefaultReactNativeHost(this) {
          override fun getPackages(): List<ReactPackage> {
            val packages = PackageList(this).packages.toMutableList()
            packages.add(RivoMediaPackage())
            return packages
          }

          override fun getJSMainModuleName(): String = "index"

          override fun getUseDeveloperSupport(): Boolean = false

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED

          override fun getJSBundleFile(): String? {
            try {
              val prefs = this@MainApplication.getSharedPreferences("rivo_ota_prefs", Context.MODE_PRIVATE)
              val lastVersionCode = prefs.getInt("last_app_version_code", -1)
              val currentVersionCode = BuildConfig.VERSION_CODE

              val otaDir = java.io.File(this@MainApplication.filesDir, "rivo_ota")
              if (lastVersionCode != -1 && lastVersionCode < currentVersionCode) {
                // If app was updated via full APK, clear legacy OTA bundles
                if (otaDir.exists()) {
                  otaDir.deleteRecursively()
                }
                prefs.edit().putInt("last_app_version_code", currentVersionCode).apply()
                return super.getJSBundleFile()
              }
              prefs.edit().putInt("last_app_version_code", currentVersionCode).apply()

              val otaBundle = java.io.File(otaDir, "index.android.bundle")
              if (otaBundle.exists() && otaBundle.isFile && otaBundle.length() > 1024) {
                return otaBundle.absolutePath
              }
            } catch (e: Exception) {
              android.util.Log.e("RivoOTA", "Error resolving OTA bundle: ${e.message}")
            }
            return super.getJSBundleFile()
          }
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  private fun cleanupOldInstallers() {
    try {
      val targetDirs = listOf(
        applicationContext.cacheDir,
        applicationContext.externalCacheDir,
        applicationContext.filesDir
      )
      for (dir in targetDirs) {
        if (dir == null || !dir.exists()) continue
        dir.listFiles()?.forEach { file ->
          if (file.isFile && (file.name.endsWith(".apk", ignoreCase = true) || file.name.endsWith(".ipa", ignoreCase = true) || file.name.startsWith("rivo_ota_temp", ignoreCase = true))) {
            try { file.delete() } catch (ignored: Exception) {}
          }
        }
      }
    } catch (e: Exception) {
      android.util.Log.e("Rivo", "Failed to cleanup old installers: ${e.message}")
    }
  }

  override fun onCreate() {
    super.onCreate()
    cleanupOldInstallers()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
