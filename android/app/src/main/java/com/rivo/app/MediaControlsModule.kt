package com.rivo.app

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class MediaControlsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private var instance: MediaControlsModule? = null

        fun sendEvent(action: String) {
            instance?.sendEventInternal(action)
        }
    }

    init {
        instance = this
    }

    override fun getName(): String = "RivoMediaControls"

    @ReactMethod
    fun showNotification(options: ReadableMap) {
        val context = reactContext.applicationContext
        val intent = Intent(context, MediaNotificationService::class.java).apply {
            action = MediaNotificationService.ACTION_SHOW
            if (options.hasKey("title")) putExtra("title", options.getString("title"))
            if (options.hasKey("artist")) putExtra("artist", options.getString("artist"))
            if (options.hasKey("coverUrl")) putExtra("coverUrl", options.getString("coverUrl"))
            if (options.hasKey("isPlaying")) putExtra("isPlaying", options.getBoolean("isPlaying"))
            if (options.hasKey("isRepeat")) putExtra("isRepeat", options.getBoolean("isRepeat"))
            if (options.hasKey("isShuffle")) putExtra("isShuffle", options.getBoolean("isShuffle"))
            if (options.hasKey("isLiked")) putExtra("isLiked", options.getBoolean("isLiked"))
            if (options.hasKey("duration")) putExtra("duration", options.getDouble("duration"))
            if (options.hasKey("currentTime")) putExtra("currentTime", options.getDouble("currentTime"))
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (e: Throwable) {
            // Ignore start failures if app is restricted
        }
    }

    @ReactMethod
    fun updatePlayback(options: ReadableMap) {
        val context = reactContext.applicationContext
        val intent = Intent(context, MediaNotificationService::class.java).apply {
            action = MediaNotificationService.ACTION_UPDATE
            if (options.hasKey("title")) putExtra("title", options.getString("title"))
            if (options.hasKey("artist")) putExtra("artist", options.getString("artist"))
            if (options.hasKey("coverUrl")) putExtra("coverUrl", options.getString("coverUrl"))
            if (options.hasKey("isPlaying")) putExtra("isPlaying", options.getBoolean("isPlaying"))
            if (options.hasKey("isRepeat")) putExtra("isRepeat", options.getBoolean("isRepeat"))
            if (options.hasKey("isShuffle")) putExtra("isShuffle", options.getBoolean("isShuffle"))
            if (options.hasKey("isLiked")) putExtra("isLiked", options.getBoolean("isLiked"))
            if (options.hasKey("duration")) putExtra("duration", options.getDouble("duration"))
            if (options.hasKey("currentTime")) putExtra("currentTime", options.getDouble("currentTime"))
        }

        try {
            context.startService(intent)
        } catch (e: Throwable) {
            // Ignore update failures
        }
    }

    @ReactMethod
    fun hideNotification() {
        val context = reactContext.applicationContext
        val intent = Intent(context, MediaNotificationService::class.java).apply {
            action = MediaNotificationService.ACTION_HIDE
        }
        try {
            context.startService(intent)
        } catch (e: Throwable) {}
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for React Native built-in EventEmitter calls
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for React Native built-in EventEmitter calls
    }

    private fun sendEventInternal(action: String) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onMediaAction", action)
        }
    }
}
