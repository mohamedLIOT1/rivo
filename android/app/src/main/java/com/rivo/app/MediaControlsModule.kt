package com.rivo.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class MediaControlsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val CHAT_CHANNEL_ID = "rivo_chat_channel"
        const val CHAT_NOTIF_TAG = "rivo_chat"
        const val CHAT_GROUP_KEY = "com.rivo.app.CHAT_MESSAGES"

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
            if (options.hasKey("repeatMode")) putExtra("repeatMode", options.getString("repeatMode"))
            else if (options.hasKey("isRepeat")) putExtra("isRepeat", options.getBoolean("isRepeat"))
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
            if (options.hasKey("repeatMode")) putExtra("repeatMode", options.getString("repeatMode"))
            else if (options.hasKey("isRepeat")) putExtra("isRepeat", options.getBoolean("isRepeat"))
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
        } catch (e: Throwable) {
            // Ignore notification errors
        }
    }

    @ReactMethod
    fun dismissChatNotification(senderId: String) {
        try {
            val context = reactContext.applicationContext
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            val notifId = (senderId.hashCode() and 0x7FFFFFFF)
            notificationManager?.cancel(CHAT_NOTIF_TAG, notifId)
        } catch (e: Throwable) {}
    }

    @ReactMethod
    fun dismissAllChatNotifications() {
        try {
            val context = reactContext.applicationContext
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.cancel(CHAT_NOTIF_TAG, 0)
        } catch (e: Throwable) {}
    }

    private fun sendEventInternal(action: String) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onMediaAction", action)
        }
    }
}
