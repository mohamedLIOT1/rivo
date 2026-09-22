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
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
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
        const val ACTION_LIKE = "com.rivo.app.ACTION_LIKE"
        const val ACTION_FORWARD = "com.rivo.app.ACTION_FORWARD"

        var currentTitle: String = "Rivo Music"
        var currentArtist: String = "Playing in Background"
        var currentCoverUrl: String? = null
        var isPlaying: Boolean = false
        var isRepeat: Boolean = false
        var isShuffle: Boolean = false
        var isLiked: Boolean = false
        var currentDurationMs: Long = 0L
        var currentPositionMs: Long = 0L
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
                wakeLock?.acquire(4 * 60 * 60 * 1000L) // 4 hours safe timeout
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

                override fun onSeekTo(pos: Long) {
                    currentPositionMs = pos
                    updateNotification()
                    MediaControlsModule.sendEvent("seek:${pos / 1000.0}")
                }

                override fun onCustomAction(action: String?, extras: Bundle?) {
                    when (action) {
                        ACTION_LIKE, "like" -> dispatchMediaAction("like")
                        ACTION_REPEAT, "repeat" -> dispatchMediaAction("repeat")
                        ACTION_SHUFFLE, "shuffle" -> dispatchMediaAction("shuffle")
                        else -> if (!action.isNullOrBlank()) dispatchMediaAction(action)
                    }
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
                isLiked = intent.getBooleanExtra("isLiked", false)

                if (intent.hasExtra("duration")) {
                    val dSec = intent.getDoubleExtra("duration", 0.0)
                    if (dSec > 0) currentDurationMs = (dSec * 1000).toLong()
                }
                if (intent.hasExtra("currentTime")) {
                    val cSec = intent.getDoubleExtra("currentTime", 0.0)
                    if (cSec >= 0) currentPositionMs = (cSec * 1000).toLong()
                }

                if (isPlaying) acquireWakeLock() else releaseWakeLock()
                startForegroundWithNotification()
                loadCoverBitmapAsync(currentCoverUrl)
            }
            ACTION_UPDATE -> {
                isPlaying = intent.getBooleanExtra("isPlaying", isPlaying)
                isRepeat = intent.getBooleanExtra("isRepeat", isRepeat)
                isShuffle = intent.getBooleanExtra("isShuffle", isShuffle)
                if (intent.hasExtra("isLiked")) isLiked = intent.getBooleanExtra("isLiked", isLiked)
                if (intent.hasExtra("title")) currentTitle = intent.getStringExtra("title") ?: currentTitle
                if (intent.hasExtra("artist")) currentArtist = intent.getStringExtra("artist") ?: currentArtist

                if (intent.hasExtra("duration")) {
                    val dSec = intent.getDoubleExtra("duration", 0.0)
                    if (dSec > 0) currentDurationMs = (dSec * 1000).toLong()
                }
                if (intent.hasExtra("currentTime")) {
                    val cSec = intent.getDoubleExtra("currentTime", 0.0)
                    if (cSec >= 0) currentPositionMs = (cSec * 1000).toLong()
                }

                if (intent.hasExtra("coverUrl")) {
                    val newCover = intent.getStringExtra("coverUrl")
                    if (!newCover.isNullOrBlank() && newCover != currentCoverUrl) {
                        currentCoverUrl = newCover
                        loadCoverBitmapAsync(newCover)
                    }
                }

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
            ACTION_LIKE -> dispatchMediaAction("like")
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
        } else if (action == "like") {
            isLiked = !isLiked
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

        val likeIntent = makeActionIntent(ACTION_LIKE, 100)
        val prevIntent = makeActionIntent(ACTION_PREV, 101)
        val playPauseIntent = makeActionIntent(ACTION_PLAY_PAUSE, 102)
        val nextIntent = makeActionIntent(ACTION_NEXT, 103)
        val repeatIntent = makeActionIntent(ACTION_REPEAT, 104)
        val shuffleIntent = makeActionIntent(ACTION_SHUFFLE, 105)

        // 1. Configure PlaybackStateCompat with seek capability, speed, and real-time position
        val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val speed = if (isPlaying) 1.0f else 0.0f
        val playbackActions = PlaybackStateCompat.ACTION_PLAY or
            PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_PLAY_PAUSE or
            PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
            PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
            PlaybackStateCompat.ACTION_SEEK_TO or
            PlaybackStateCompat.ACTION_SET_REPEAT_MODE or
            PlaybackStateCompat.ACTION_SET_SHUFFLE_MODE

        val playbackStateBuilder = PlaybackStateCompat.Builder()
            .setActions(playbackActions)
            .setState(state, currentPositionMs, speed, SystemClock.elapsedRealtime())

        // Custom Actions for modern Android 13+ SystemUI Media Controls
        val likeIconRes = if (isLiked) R.drawable.ic_notification_liked else R.drawable.ic_notification_like
        val likeLabel = if (isLiked) "Liked" else "Like"
        playbackStateBuilder.addCustomAction(
            PlaybackStateCompat.CustomAction.Builder(ACTION_LIKE, likeLabel, likeIconRes).build()
        )

        val shuffleLabel = if (isShuffle) "Shuffle (On)" else "Shuffle (Off)"
        playbackStateBuilder.addCustomAction(
            PlaybackStateCompat.CustomAction.Builder(ACTION_SHUFFLE, shuffleLabel, R.drawable.ic_notification_shuffle).build()
        )

        val repeatLabel = if (isRepeat) "Repeat (On)" else "Repeat (Off)"
        playbackStateBuilder.addCustomAction(
            PlaybackStateCompat.CustomAction.Builder(ACTION_REPEAT, repeatLabel, R.drawable.ic_notification_repeat).build()
        )

        mediaSession?.setPlaybackState(playbackStateBuilder.build())

        // 2. Configure MediaMetadataCompat with Duration and Artwork
        val metadataBuilder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Rivo Music")

        if (currentDurationMs > 0L) {
            metadataBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDurationMs)
        }

        currentBitmap?.let {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, it)
        }
        mediaSession?.setMetadata(metadataBuilder.build())

        val playPauseIcon = if (isPlaying) R.drawable.ic_notification_pause else R.drawable.ic_notification_play
        val playPauseLabel = if (isPlaying) "Pause" else "Play"

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
            // Actions order:
            // 0: Like
            // 1: Previous
            // 2: Play/Pause
            // 3: Next
            // 4: Repeat
            // 5: Shuffle
            .addAction(likeIconRes, likeLabel, likeIntent)                           // 0
            .addAction(R.drawable.ic_notification_prev, "Previous", prevIntent)       // 1
            .addAction(playPauseIcon, playPauseLabel, playPauseIntent)                 // 2
            .addAction(R.drawable.ic_notification_next, "Next", nextIntent)           // 3
            .addAction(R.drawable.ic_notification_repeat, repeatLabel, repeatIntent) // 4
            .addAction(R.drawable.ic_notification_shuffle, shuffleLabel, shuffleIntent) // 5

        currentBitmap?.let {
            builder.setLargeIcon(it)
        }

        // Apply MediaStyle with compact actions (Prev = 1, Play/Pause = 2, Next = 3)
        val style = MediaStyle()
            .setMediaSession(mediaSession?.sessionToken)
            .setShowActionsInCompactView(1, 2, 3)
            .setShowCancelButton(true)
            .setCancelButtonIntent(makeActionIntent(ACTION_HIDE, 107))

        builder.setStyle(style)
        return builder.build()
    }

    /**
     * Cleans up YouTube letterbox/pillarbox borders and delivers a crisp, properly centered album art.
     */
    private fun cleanArtworkBitmap(source: Bitmap): Bitmap {
        val width = source.width
        val height = source.height
        if (width <= 20 || height <= 20) return source

        fun isDarkPixel(color: Int): Boolean {
            val r = (color shr 16) and 0xFF
            val g = (color shr 8) and 0xFF
            val b = color and 0xFF
            return r < 24 && g < 24 && b < 24
        }

        fun isRowDark(y: Int): Boolean {
            val step = maxOf(1, width / 20)
            var darkCount = 0
            var total = 0
            for (x in 0 until width step step) {
                total++
                if (isDarkPixel(source.getPixel(x, y))) darkCount++
            }
            return darkCount.toFloat() / total >= 0.90f
        }

        fun isColDark(x: Int): Boolean {
            val step = maxOf(1, height / 20)
            var darkCount = 0
            var total = 0
            for (y in 0 until height step step) {
                total++
                if (isDarkPixel(source.getPixel(x, y))) darkCount++
            }
            return darkCount.toFloat() / total >= 0.90f
        }

        var top = 0
        while (top < height / 3 && isRowDark(top)) top++

        var bottom = height - 1
        while (bottom > height * 2 / 3 && isRowDark(bottom)) bottom--

        var left = 0
        while (left < width / 3 && isColDark(left)) left++

        var right = width - 1
        while (right > width * 2 / 3 && isColDark(right)) right--

        val cropW = right - left + 1
        val cropH = bottom - top + 1

        val cropped = if (cropW > 40 && cropH > 40 && (cropW < width || cropH < height)) {
            Bitmap.createBitmap(source, left, top, cropW, cropH)
        } else {
            source
        }

        // Center-crop to 1:1 if aspect ratio is non-square so it acts as standard album art
        val targetSize = 512
        val finalW = cropped.width
        val finalH = cropped.height

        val squareBitmap = if (Math.abs(finalW - finalH) > 12) {
            val minDim = minOf(finalW, finalH)
            val xOff = (finalW - minDim) / 2
            val yOff = (finalH - minDim) / 2
            val centerSquare = Bitmap.createBitmap(cropped, xOff, yOff, minDim, minDim)
            Bitmap.createScaledBitmap(centerSquare, targetSize, targetSize, true)
        } else {
            Bitmap.createScaledBitmap(cropped, targetSize, targetSize, true)
        }

        return squareBitmap
    }

    private fun loadCoverBitmapAsync(urlStr: String?) {
        if (urlStr.isNullOrBlank() || urlStr == lastLoadedCoverUrl) return
        lastLoadedCoverUrl = urlStr

        thread {
            try {
                // If YouTube hqdefault, attempt to fetch maxresdefault or sddefault first for highest clarity
                var effectiveUrl = urlStr
                var rawBitmap: Bitmap? = null

                if (urlStr.contains("hqdefault.jpg")) {
                    val maxResUrl = urlStr.replace("hqdefault.jpg", "maxresdefault.jpg")
                    try {
                        val conn = URL(maxResUrl).openConnection() as HttpURLConnection
                        conn.connectTimeout = 3000
                        conn.readTimeout = 3000
                        conn.connect()
                        if (conn.responseCode == 200) {
                            rawBitmap = BitmapFactory.decodeStream(conn.inputStream)
                        }
                    } catch (_: Throwable) {}
                }

                if (rawBitmap == null) {
                    rawBitmap = when {
                        effectiveUrl.startsWith("file://") -> {
                            val path = Uri.parse(effectiveUrl).path ?: effectiveUrl.replace("file://", "")
                            BitmapFactory.decodeFile(path)
                        }
                        effectiveUrl.startsWith("http://") || effectiveUrl.startsWith("https://") -> {
                            val connection = URL(effectiveUrl).openConnection() as HttpURLConnection
                            connection.doInput = true
                            connection.connectTimeout = 6000
                            connection.readTimeout = 6000
                            connection.connect()
                            val input: InputStream = connection.inputStream
                            BitmapFactory.decodeStream(input)
                        }
                        else -> null
                    }
                }

                if (rawBitmap != null) {
                    currentBitmap = cleanArtworkBitmap(rawBitmap)
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
