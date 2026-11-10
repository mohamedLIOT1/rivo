package com.rivo.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class MediaControlsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val CHAT_CHANNEL_ID = "rivo_chat_channel"
        const val CHAT_NOTIF_TAG = "rivo_chat"
        const val CHAT_GROUP_KEY = "com.rivo.app.CHAT_MESSAGES"

        private var instance: MediaControlsModule? = null
        var initialChatSenderId: String? = null
        var initialJamRoomCode: String? = null

        fun sendEvent(action: String) {
            instance?.sendEventInternal(action)
        }

        fun handleNewIntent(intent: Intent?) {
            intent?.let {
                val senderId = it.getStringExtra("openChatSenderId")
                val roomCode = it.getStringExtra("joinJamRoomCode")
                if (!senderId.isNullOrEmpty()) {
                    initialChatSenderId = senderId
                    instance?.emitChatNotificationEvent(senderId, roomCode)
                }
            }
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
            copyOptionsToIntent(options, this)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (_: Throwable) {}
    }

    @ReactMethod
    fun updatePlayback(options: ReadableMap) {
        val context = reactContext.applicationContext
        val isPlaying = if (options.hasKey("isPlaying")) options.getBoolean("isPlaying") else false

        val intent = Intent(context, MediaNotificationService::class.java).apply {
            action = if (MediaNotificationService.instance == null && isPlaying) {
                MediaNotificationService.ACTION_SHOW
            } else {
                MediaNotificationService.ACTION_UPDATE
            }
            copyOptionsToIntent(options, this)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && MediaNotificationService.instance == null && isPlaying) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (_: Throwable) {}
    }

    private fun copyOptionsToIntent(options: ReadableMap, intent: Intent) {
        if (options.hasKey("title")) intent.putExtra("title", options.getString("title"))
        if (options.hasKey("artist")) intent.putExtra("artist", options.getString("artist"))
        if (options.hasKey("coverUrl")) intent.putExtra("coverUrl", options.getString("coverUrl"))
        if (options.hasKey("isPlaying")) intent.putExtra("isPlaying", options.getBoolean("isPlaying"))
        if (options.hasKey("repeatMode")) intent.putExtra("repeatMode", options.getString("repeatMode"))
        else if (options.hasKey("isRepeat")) intent.putExtra("isRepeat", options.getBoolean("isRepeat"))
        if (options.hasKey("isShuffle")) intent.putExtra("isShuffle", options.getBoolean("isShuffle"))
        if (options.hasKey("isLiked")) intent.putExtra("isLiked", options.getBoolean("isLiked"))
        if (options.hasKey("duration")) intent.putExtra("duration", options.getDouble("duration"))
        if (options.hasKey("currentTime")) intent.putExtra("currentTime", options.getDouble("currentTime"))
    }

    @ReactMethod
    fun hideNotification() {
        val context = reactContext.applicationContext
        val intent = Intent(context, MediaNotificationService::class.java).apply {
            action = MediaNotificationService.ACTION_HIDE
        }
        try {
            context.startService(intent)
        } catch (_: Throwable) {}
    }

    @ReactMethod
    fun updateQueue(queueArray: ReadableArray?, currentTrackId: String?) {
        LockScreenQueueStore.updateFromBridge(queueArray, currentTrackId)
        LockScreenActivity.notifyPlaybackChanged()
    }

    @ReactMethod
    fun checkNotificationPermission(promise: Promise) {
        try {
            val enabled = NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
            promise.resolve(enabled)
        } catch (e: Throwable) {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestNotificationPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val isEnabled = NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
                if (isEnabled) {
                    promise.resolve(true)
                    return
                }

                val activity = reactContext.currentActivity
                if (activity is PermissionAwareActivity) {
                    val permissions = arrayOf(android.Manifest.permission.POST_NOTIFICATIONS)
                    activity.requestPermissions(permissions, 9541, object : PermissionListener {
                        override fun onRequestPermissionsResult(
                            requestCode: Int,
                            permissions: Array<String>,
                            grantResults: IntArray
                        ): Boolean {
                            if (requestCode == 9541) {
                                val granted = grantResults.isNotEmpty() &&
                                    grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED
                                promise.resolve(granted)
                                return true
                            }
                            return false
                        }
                    })
                } else {
                    promise.resolve(isEnabled)
                }
            } else {
                promise.resolve(NotificationManagerCompat.from(reactContext).areNotificationsEnabled())
            }
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = Intent().apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    action = Settings.ACTION_APP_NOTIFICATION_SETTINGS
                    putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
                } else {
                    action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                    data = Uri.parse("package:${reactContext.packageName}")
                }
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setLockScreenEnabled(enabled: Boolean) {
        try {
            val prefs = reactContext.getSharedPreferences("rivo_prefs", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("lockscreen_overlay_enabled", enabled).apply()
            if (!enabled) {
                LockScreenActivity.dismissIfShowing()
            }
        } catch (_: Throwable) {}
    }

    @ReactMethod
    fun isLockScreenEnabled(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("rivo_prefs", Context.MODE_PRIVATE)
            val isEnabled = prefs.getBoolean("lockscreen_overlay_enabled", true)
            promise.resolve(isEnabled)
        } catch (e: Throwable) {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                promise.resolve(Settings.canDrawOverlays(reactContext))
            } else {
                promise.resolve(true)
            }
        } catch (e: Throwable) {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + reactContext.packageName)
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun createChatNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            val channel = NotificationChannel(
                CHAT_CHANNEL_ID,
                "Chat Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Direct chat notifications from friends"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }
            notificationManager?.createNotificationChannel(channel)
        }
    }

    @ReactMethod
    fun showChatNotification(options: ReadableMap) {
        try {
            val context = reactContext.applicationContext
            createChatNotificationChannel()

            val senderId = if (options.hasKey("senderId")) options.getString("senderId") ?: "unknown" else "unknown"
            val senderName = if (options.hasKey("senderName")) options.getString("senderName") ?: "Friend" else "Friend"
            val message = if (options.hasKey("message")) options.getString("message") ?: "" else ""
            val isJam = if (options.hasKey("isJam")) options.getBoolean("isJam") else false
            val roomCode = if (options.hasKey("roomCode")) options.getString("roomCode") else null

            val title = if (isJam) "Jam Session from $senderName" else "Message from $senderName"
            val notifId = (senderId.hashCode() and 0x7FFFFFFF)

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("openChatSenderId", senderId)
                if (roomCode != null) putExtra("joinJamRoomCode", roomCode)
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                notifId,
                launchIntent,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
            )

            val builder = NotificationCompat.Builder(context, CHAT_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setGroup(CHAT_GROUP_KEY)

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.notify(CHAT_NOTIF_TAG, notifId, builder.build())
        } catch (_: Throwable) {}
    }

    @ReactMethod
    fun dismissChatNotification(senderId: String) {
        try {
            val context = reactContext.applicationContext
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            val notifId = (senderId.hashCode() and 0x7FFFFFFF)
            notificationManager?.cancel(CHAT_NOTIF_TAG, notifId)
        } catch (_: Throwable) {}
    }

    @ReactMethod
    fun dismissAllChatNotifications() {
        try {
            val context = reactContext.applicationContext
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.cancel(CHAT_NOTIF_TAG, 0)
        } catch (_: Throwable) {}
    }

    private fun sendEventInternal(action: String) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onMediaAction", action)
        }
    }

    fun emitChatNotificationEvent(senderId: String, roomCode: String? = null) {
        if (reactContext.hasActiveReactInstance()) {
            val map = Arguments.createMap().apply {
                putString("senderId", senderId)
                if (roomCode != null) putString("roomCode", roomCode)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onOpenChatFromNotification", map)
        }
    }

    @ReactMethod
    fun getInitialChatSenderId(promise: Promise) {
        try {
            val currentActivity = reactContext.currentActivity
            val intent = currentActivity?.intent
            val senderIdFromIntent = intent?.getStringExtra("openChatSenderId")
            val senderId = senderIdFromIntent ?: initialChatSenderId
            if (senderIdFromIntent != null) {
                intent.removeExtra("openChatSenderId")
            }
            initialChatSenderId = null
            promise.resolve(senderId)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    // OTA & APK Installation Delegations to RivoOtaHelper
    @ReactMethod
    fun installApk(filePath: String, promise: Promise) = RivoOtaHelper.installApk(reactContext, filePath, promise)

    @ReactMethod
    fun applyOtaBundle(tempFilePath: String, promise: Promise) = RivoOtaHelper.applyOtaBundle(reactContext, tempFilePath, promise)

    @ReactMethod
    fun reloadApp(promise: Promise) = RivoOtaHelper.reloadApp(reactContext, promise)

    @ReactMethod
    fun exitAndRemoveTask(promise: Promise) = RivoOtaHelper.exitAndRemoveTask(reactContext, promise)

    @ReactMethod
    fun clearOtaBundle(promise: Promise) = RivoOtaHelper.clearOtaBundle(reactContext, promise)

    @ReactMethod
    fun getOtaInfo(promise: Promise) = RivoOtaHelper.getOtaInfo(reactContext, promise)
}
