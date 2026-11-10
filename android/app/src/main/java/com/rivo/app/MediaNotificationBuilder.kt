package com.rivo.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle

object MediaNotificationBuilder {

    const val CHANNEL_ID = "rivo_playback_channel"
    const val NOTIFICATION_ID = 9541

    const val LOCKSCREEN_CHANNEL_ID = "rivo_lockscreen_channel"
    const val LOCKSCREEN_NOTIFICATION_ID = 9542

    fun createPlaybackChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val playbackChannel = NotificationChannel(
                CHANNEL_ID,
                "Rivo Music Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows now playing music controls on lockscreen and notification bar"
                setShowBadge(false)
                setSound(null, null)
                enableLights(false)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            val lockscreenChannel = NotificationChannel(
                LOCKSCREEN_CHANNEL_ID,
                "Rivo Lock Screen Player",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Displays the lock screen music player when screen turns off"
                setShowBadge(false)
                setSound(null, null)
                enableLights(false)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(playbackChannel)
            manager.createNotificationChannel(lockscreenChannel)
        }
    }

    fun build(
        context: Context,
        mediaSession: MediaSessionCompat?,
        title: String,
        artist: String,
        bitmap: Bitmap?,
        isPlaying: Boolean,
        repeatMode: String,
        isLiked: Boolean,
        positionMs: Long,
        durationMs: Long,
        withFullScreenLock: Boolean
    ): Notification {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val contentIntent = Intent(context, MainActivity::class.java).apply {
            setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val contentPendingIntent = PendingIntent.getActivity(context, 0, contentIntent, flags)

        fun makeActionIntent(actionName: String, reqCode: Int): PendingIntent {
            val i = Intent(context, MediaNotificationService::class.java).apply { action = actionName }
            return PendingIntent.getService(context, reqCode, i, flags)
        }

        // 1. PlaybackStateCompat
        val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val speed = if (isPlaying) 1.0f else 0.0f
        val playbackActions = PlaybackStateCompat.ACTION_PLAY or
            PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_PLAY_PAUSE or
            PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
            PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
            PlaybackStateCompat.ACTION_SEEK_TO or
            PlaybackStateCompat.ACTION_SET_REPEAT_MODE

        val playbackStateBuilder = PlaybackStateCompat.Builder()
            .setActions(playbackActions)
            .setState(state, positionMs, speed, SystemClock.elapsedRealtime())

        val likeIconRes = if (isLiked) R.drawable.ic_notification_liked else R.drawable.ic_notification_like
        playbackStateBuilder.addCustomAction(
            PlaybackStateCompat.CustomAction.Builder(
                MediaNotificationService.ACTION_LIKE,
                if (isLiked) "Liked" else "Like",
                likeIconRes
            ).build()
        )

        when (repeatMode) {
            "one" -> mediaSession?.setRepeatMode(PlaybackStateCompat.REPEAT_MODE_ONE)
            "all" -> mediaSession?.setRepeatMode(PlaybackStateCompat.REPEAT_MODE_ALL)
            else -> mediaSession?.setRepeatMode(PlaybackStateCompat.REPEAT_MODE_NONE)
        }

        val repeatIconRes = when (repeatMode) {
            "one" -> R.drawable.ic_notification_repeat_on
            "all" -> R.drawable.ic_notification_repeat_all
            else -> R.drawable.ic_notification_repeat
        }
        playbackStateBuilder.addCustomAction(
            PlaybackStateCompat.CustomAction.Builder(
                MediaNotificationService.ACTION_REPEAT,
                "Repeat",
                repeatIconRes
            ).build()
        )
        mediaSession?.setPlaybackState(playbackStateBuilder.build())

        // 2. MediaMetadataCompat
        val metadataBuilder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Rivo Music")
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, "Rivo Music")

        if (durationMs > 0L) {
            metadataBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)
        }

        metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
        metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bitmap)
        metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, bitmap)
        mediaSession?.setMetadata(metadataBuilder.build())

        val playPauseIcon = if (isPlaying) R.drawable.ic_notification_pause else R.drawable.ic_notification_play
        val playPauseLabel = if (isPlaying) "Pause" else "Play"

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText("Rivo")
            .setContentIntent(contentPendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOnlyAlertOnce(true)
            .setOngoing(isPlaying)
            .addAction(likeIconRes, if (isLiked) "Liked" else "Like", makeActionIntent(MediaNotificationService.ACTION_LIKE, 100))
            .addAction(R.drawable.ic_notification_prev, "Previous", makeActionIntent(MediaNotificationService.ACTION_PREV, 101))
            .addAction(playPauseIcon, playPauseLabel, makeActionIntent(MediaNotificationService.ACTION_PLAY_PAUSE, 102))
            .addAction(R.drawable.ic_notification_next, "Next", makeActionIntent(MediaNotificationService.ACTION_NEXT, 103))
            .addAction(repeatIconRes, "Repeat", makeActionIntent(MediaNotificationService.ACTION_REPEAT, 104))

        if (withFullScreenLock) {
            val lockIntent = Intent(context, LockScreenActivity::class.java).apply {
                setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val lockPendingIntent = PendingIntent.getActivity(context, 199, lockIntent, flags)
            builder.setFullScreenIntent(lockPendingIntent, true)
            builder.setPriority(NotificationCompat.PRIORITY_HIGH)
        }

        builder.setLargeIcon(bitmap)
        val style = MediaStyle()
            .setMediaSession(mediaSession?.sessionToken)
            .setShowActionsInCompactView(1, 2, 3)
            .setShowCancelButton(true)
            .setCancelButtonIntent(makeActionIntent(MediaNotificationService.ACTION_HIDE, 107))

        builder.setStyle(style)
        return builder.build()
    }

    fun buildLockscreenLaunchNotification(
        context: Context,
        title: String,
        artist: String
    ): Notification {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val lockIntent = Intent(context, LockScreenActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val lockPendingIntent = PendingIntent.getActivity(context, 199, lockIntent, flags)

        return NotificationCompat.Builder(context, LOCKSCREEN_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText("Rivo")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(lockPendingIntent, true)
            .setOngoing(false)
            .setAutoCancel(true)
            .setSilent(true)
            .build()
    }
}
