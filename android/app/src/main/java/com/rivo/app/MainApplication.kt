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
              val prefs = applicationContext.getSharedPreferences("rivo_ota_prefs", Context.MODE_PRIVATE)
              val lastVersionCode = prefs.getInt("last_app_version_code", -1)
              val currentVersionCode = BuildConfig.VERSION_CODE

              val otaDir = java.io.File(applicationContext.filesDir, "rivo_ota")
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

  override fun onCreate() {
    super.onCreate()
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
