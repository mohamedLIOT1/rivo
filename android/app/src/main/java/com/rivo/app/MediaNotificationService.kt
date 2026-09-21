package com.rivo.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.IBinder
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import android.content.pm.ServiceInfo
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MediaNotificationService : Service() {

    companion object {
        const val CHANNEL_ID = "rivo_playback_channel"
        const val NOTIFICATION_ID = 9541

        const val ACTION_SHOW = "com.rivo.app.ACTION_SHOW"
        const val ACTION_UPDATE = "com.rivo.app.ACTION_UPDATE"
        const val ACTION_HIDE = "com.rivo.app.ACTION_HIDE"

        // Media Action Button Intents
        const val ACTION_PLAY = "com.rivo.app.ACTION_PLAY"
        const val ACTION_PAUSE = "com.rivo.app.ACTION_PAUSE"
        const val ACTION_PLAY_PAUSE = "com.rivo.app.ACTION_PLAY_PAUSE"
        const val ACTION_PREV = "com.rivo.app.ACTION_PREV"
        const val ACTION_NEXT = "com.rivo.app.ACTION_NEXT"
        const val ACTION_REPEAT = "com.rivo.app.ACTION_REPEAT"
        const val ACTION_SHUFFLE = "com.rivo.app.ACTION_SHUFFLE"
        const val ACTION_FORWARD = "com.rivo.app.ACTION_FORWARD"

        var currentTitle: String = "Rivo Music"
        var currentArtist: String = "Playing in Background"
        var currentCoverUrl: String? = null
        var isPlaying: Boolean = false
        var isRepeat: Boolean = false
        var isShuffle: Boolean = false
        var currentBitmap: Bitmap? = null
        private var lastLoadedCoverUrl: String? = null
    }

    private var mediaSession: MediaSessionCompat? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        setupMediaSession()
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Rivo::PlaybackWakeLock").apply {
                setReferenceCounted(false)
            }
        } catch (_: Throwable) {}
    }

    private fun acquireWakeLock() {
        try {
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire(4 * 60 * 60 * 1000L) // 4 hours max safe timeout
            }
        } catch (_: Throwable) {}
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (_: Throwable) {}
    }

    private fun setupMediaSession() {
        mediaSession = MediaSessionCompat(this, "RivoMediaSession").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    dispatchMediaAction("play")
                }

                override fun onPause() {
                    dispatchMediaAction("pause")
                }

                override fun onSkipToNext() {
                    dispatchMediaAction("next")
                }

                override fun onSkipToPrevious() {
                    dispatchMediaAction("prev")
                }

                override fun onFastForward() {
                    dispatchMediaAction("forward")
                }

                override fun onRewind() {
                    dispatchMediaAction("rewind")
                }

                override fun onSetRepeatMode(repeatMode: Int) {
                    dispatchMediaAction("repeat")
                }

                override fun onSetShuffleMode(shuffleMode: Int) {
                    dispatchMediaAction("shuffle")
                }
            })
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_NOT_STICKY

        when (action) {
            ACTION_SHOW -> {
                currentTitle = intent.getStringExtra("title") ?: currentTitle
                currentArtist = intent.getStringExtra("artist") ?: currentArtist
                currentCoverUrl = intent.getStringExtra("coverUrl")
                isPlaying = intent.getBooleanExtra("isPlaying", true)
                isRepeat = intent.getBooleanExtra("isRepeat", false)
                isShuffle = intent.getBooleanExtra("isShuffle", false)

                if (isPlaying) acquireWakeLock() else releaseWakeLock()
                startForegroundWithNotification()
                loadCoverBitmapAsync(currentCoverUrl)
            }
            ACTION_UPDATE -> {
                isPlaying = intent.getBooleanExtra("isPlaying", isPlaying)
                isRepeat = intent.getBooleanExtra("isRepeat", isRepeat)
                isShuffle = intent.getBooleanExtra("isShuffle", isShuffle)
                if (intent.hasExtra("title")) currentTitle = intent.getStringExtra("title") ?: currentTitle
                if (intent.hasExtra("artist")) currentArtist = intent.getStringExtra("artist") ?: currentArtist

                if (isPlaying) {
                    acquireWakeLock()
                    startForegroundWithNotification()
                } else {
                    releaseWakeLock()
                }
                updateNotification()
            }
            ACTION_HIDE -> {
                releaseWakeLock()
                stopForeground(true)
                stopSelf()
            }
            ACTION_PLAY -> dispatchMediaAction("play")
            ACTION_PAUSE -> dispatchMediaAction("pause")
            ACTION_PLAY_PAUSE -> dispatchMediaAction(if (isPlaying) "pause" else "play")
            ACTION_PREV -> dispatchMediaAction("prev")
            ACTION_NEXT -> dispatchMediaAction("next")
            ACTION_REPEAT -> dispatchMediaAction("repeat")
            ACTION_SHUFFLE -> dispatchMediaAction("shuffle")
            ACTION_FORWARD -> dispatchMediaAction("forward")
        }

        return START_NOT_STICKY
    }

    private fun dispatchMediaAction(action: String) {
        // Toggle state locally immediately for visual response
        if (action == "play") {
            isPlaying = true
            acquireWakeLock()
            startForegroundWithNotification()
        } else if (action == "pause") {
            isPlaying = false
            releaseWakeLock()
        } else if (action == "repeat") {
            isRepeat = !isRepeat
        } else if (action == "shuffle") {
            isShuffle = !isShuffle
        }

        updateNotification()

        // Relay event to React Native JS layer
        MediaControlsModule.sendEvent(action)
    }

    private fun startForegroundWithNotification() {
        try {
            val notification = buildMediaNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Throwable) {
            try {
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, buildMediaNotification())
            } catch (_: Throwable) {}
        }
    }

    private fun updateNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildMediaNotification())
    }

    private fun buildMediaNotification(): Notification {
        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        // Tap notification to open main app
        val contentIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(this, 0, contentIntent, pendingIntentFlags)

        // Action PendingIntents
        fun makeActionIntent(actionName: String, reqCode: Int): PendingIntent {
            val i = Intent(this, MediaNotificationService::class.java).apply { action = actionName }
            return PendingIntent.getService(this, reqCode, i, pendingIntentFlags)
        }

        val prevIntent = makeActionIntent(ACTION_PREV, 101)
        val playPauseIntent = makeActionIntent(ACTION_PLAY_PAUSE, 102)
        val nextIntent = makeActionIntent(ACTION_NEXT, 103)
        val repeatIntent = makeActionIntent(ACTION_REPEAT, 104)
        val shuffleIntent = makeActionIntent(ACTION_SHUFFLE, 105)
        val forwardIntent = makeActionIntent(ACTION_FORWARD, 106)

        // Update MediaSession state
        val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val playbackState = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_FAST_FORWARD or
                PlaybackStateCompat.ACTION_SET_REPEAT_MODE or
                PlaybackStateCompat.ACTION_SET_SHUFFLE_MODE
            )
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f)
            .build()
        mediaSession?.setPlaybackState(playbackState)

        val metadataBuilder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Rivo Music")
        currentBitmap?.let {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
        }
        mediaSession?.setMetadata(metadataBuilder.build())

        val playPauseIcon = if (isPlaying) R.drawable.ic_notification_pause else R.drawable.ic_notification_play
        val playPauseLabel = if (isPlaying) "Pause" else "Play"
        val repeatLabel = if (isRepeat) "Repeat (On)" else "Repeat (Off)"
        val shuffleLabel = if (isShuffle) "Shuffle (On)" else "Shuffle (Off)"

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText("Rivo")
            .setContentIntent(contentPendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOnlyAlertOnce(true)
            .setOngoing(isPlaying)
            // Actions
            .addAction(R.drawable.ic_notification_prev, "Previous", prevIntent) // 0
            .addAction(playPauseIcon, playPauseLabel, playPauseIntent)           // 1
            .addAction(R.drawable.ic_notification_next, "Next", nextIntent)         // 2
            .addAction(R.drawable.ic_notification_repeat, repeatLabel, repeatIntent) // 3
            .addAction(R.drawable.ic_notification_shuffle, shuffleLabel, shuffleIntent) // 4
            .addAction(R.drawable.ic_notification_ff, "+10s", forwardIntent)       // 5

        currentBitmap?.let {
            builder.setLargeIcon(it)
        }

        // Apply MediaStyle with compact actions (Prev = 0, Play/Pause = 1, Next = 2)
        val style = MediaStyle()
            .setMediaSession(mediaSession?.sessionToken)
            .setShowActionsInCompactView(0, 1, 2)
            .setShowCancelButton(true)
            .setCancelButtonIntent(makeActionIntent(ACTION_HIDE, 107))

        builder.setStyle(style)
        return builder.build()
    }

    private fun loadCoverBitmapAsync(urlStr: String?) {
        if (urlStr.isNullOrBlank() || urlStr == lastLoadedCoverUrl) return
        lastLoadedCoverUrl = urlStr

        thread {
            try {
                val bmp: Bitmap? = when {
                    urlStr.startsWith("file://") -> {
                        val path = Uri.parse(urlStr).path ?: urlStr.replace("file://", "")
                        BitmapFactory.decodeFile(path)
                    }
                    urlStr.startsWith("http://") || urlStr.startsWith("https://") -> {
                        val connection = URL(urlStr).openConnection() as HttpURLConnection
                        connection.doInput = true
                        connection.connectTimeout = 6000
                        connection.readTimeout = 6000
                        connection.connect()
                        val input: InputStream = connection.inputStream
                        BitmapFactory.decodeStream(input)
                    }
                    else -> null
                }

                if (bmp != null) {
                    currentBitmap = Bitmap.createScaledBitmap(bmp, 256, 256, true)
                    updateNotification()
                }
            } catch (e: Exception) {
                // Ignore failure and keep using default / no large icon
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Rivo Music Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows now playing music controls on lockscreen and notification bar"
                setShowBadge(false)
                setSound(null, null)
                enableLights(false)
                enableVibration(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        releaseWakeLock()
        mediaSession?.release()
        super.onDestroy()
    }
}
