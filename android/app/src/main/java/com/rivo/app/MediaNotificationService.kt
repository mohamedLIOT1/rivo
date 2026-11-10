package com.rivo.app

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.support.v4.media.session.MediaSessionCompat

class MediaNotificationService : Service() {

    companion object {
        const val CHANNEL_ID = MediaNotificationBuilder.CHANNEL_ID
        const val NOTIFICATION_ID = MediaNotificationBuilder.NOTIFICATION_ID
        const val ACTION_SHOW = "com.rivo.app.ACTION_SHOW"
        const val ACTION_UPDATE = "com.rivo.app.ACTION_UPDATE"
        const val ACTION_HIDE = "com.rivo.app.ACTION_HIDE"
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
        var repeatMode: String = "off"
        var isShuffle: Boolean = false
        var isLiked: Boolean = false
        var currentDurationMs: Long = 0L
        var currentPositionMs: Long = 0L
        @Volatile var lastPositionUpdateElapsedRealtime: Long = SystemClock.elapsedRealtime()
        var currentBitmap: Bitmap? = null
        var instance: MediaNotificationService? = null
        val currentLyrics: List<LyricEntry> get() = LockScreenLyricsStore.currentLyrics

        fun dispatchMediaActionStatic(action: String) = instance?.dispatchMediaAction(action)

        fun getEstimatedPositionMs(): Long {
            if (!isPlaying) return currentPositionMs
            val elapsed = (SystemClock.elapsedRealtime() - lastPositionUpdateElapsedRealtime).coerceAtLeast(0L)
            val estimated = currentPositionMs + elapsed
            return if (currentDurationMs > 0L) estimated.coerceAtMost(currentDurationMs) else estimated
        }

        private fun updateSeekState(posMs: Long) {
            val now = SystemClock.elapsedRealtime()
            currentPositionMs = posMs.coerceAtLeast(0L)
            lastPositionUpdateElapsedRealtime = now
            lastUserSeekTimeMs = now
        }

        fun notifyLocalSeek(posMs: Long) {
            updateSeekState(posMs)
            instance?.updateNotification()
        }

        private var lastLoadedCoverUrl: String? = null
        private var lastUserSeekTimeMs: Long = 0L
        private var lastUserLikeTimeMs: Long = 0L
        private var lastUserRepeatTimeMs: Long = 0L
    }

    private var screenReceiver: BroadcastReceiver? = null
    private var mediaSession: MediaSessionCompat? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val wakeLockHandler = Handler(Looper.getMainLooper())
    private val wakeLockReleaseRunnable = Runnable { if (!isPlaying) releaseWakeLock() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        MediaNotificationBuilder.createPlaybackChannel(this)
        setupMediaSession()
        registerScreenStateReceiver()
        initWakeLock()
    }

    private fun initWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Rivo::PlaybackWakeLock").apply {
                setReferenceCounted(false)
            }
        } catch (_: Throwable) {}
    }

    private fun registerScreenStateReceiver() {
        try {
            screenReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    when (intent?.action) {
                        Intent.ACTION_SCREEN_OFF -> {
                            val prefs = getSharedPreferences("rivo_prefs", Context.MODE_PRIVATE)
                            val isLockscreenEnabled = prefs.getBoolean("lockscreen_overlay_enabled", true)
                            if (isPlaying && isLockscreenEnabled) {
                                // Keep CPU awake briefly so lock screen activity renders smoothly
                                acquireWakeLock()

                                // 1. Attempt direct activity launch (allowed on Android 9 and below, or if overlay granted)
                                try {
                                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || Settings.canDrawOverlays(this@MediaNotificationService)) {
                                        val lockIntent = Intent(this@MediaNotificationService, LockScreenActivity::class.java).apply {
                                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                                        }
                                        startActivity(lockIntent)
                                    }
                                } catch (_: Throwable) {}

                                // 2. Trigger high-priority full-screen intent notification (standard Android 10-15 mechanism)
                                try {
                                    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                                    val notif = MediaNotificationBuilder.buildLockscreenLaunchNotification(
                                        this@MediaNotificationService,
                                        currentTitle,
                                        currentArtist
                                    )
                                    manager.notify(MediaNotificationBuilder.LOCKSCREEN_NOTIFICATION_ID, notif)
                                } catch (_: Throwable) {}
                            }
                        }
                        Intent.ACTION_USER_PRESENT -> {
                            dismissLockscreenNotification()
                            LockScreenActivity.dismissIfShowing()
                        }
                    }
                }
            }
            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_SCREEN_ON)
                addAction(Intent.ACTION_USER_PRESENT)
            }
            registerReceiver(screenReceiver, filter)
        } catch (_: Throwable) {}
    }

    fun dismissLockscreenNotification() {
        try {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.cancel(MediaNotificationBuilder.LOCKSCREEN_NOTIFICATION_ID)
        } catch (_: Throwable) {}
    }

    override fun onDestroy() {
        dismissLockscreenNotification()
        try { screenReceiver?.let { unregisterReceiver(it) } } catch (_: Throwable) {}
        if (instance == this) instance = null
        releaseWakeLock()
        try {
            mediaSession?.isActive = false
            mediaSession?.release()
        } catch (_: Throwable) {}
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        } catch (_: Throwable) {}
        super.onTaskRemoved(rootIntent)
    }

    private fun acquireWakeLock() {
        try {
            if (wakeLock?.isHeld == false) wakeLock?.acquire(4 * 60 * 60 * 1000L)
        } catch (_: Throwable) {}
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Throwable) {}
    }

    private fun setupMediaSession() {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else PendingIntent.FLAG_UPDATE_CURRENT

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val sessionActivityIntent = PendingIntent.getActivity(this, 0, launchIntent, flags)

        mediaSession = MediaSessionCompat(this, "RivoMediaSession").apply {
            setSessionActivity(sessionActivityIntent)
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() = dispatchMediaAction("play")
                override fun onPause() = dispatchMediaAction("pause")
                override fun onSkipToNext() = dispatchMediaAction("next")
                override fun onSkipToPrevious() = dispatchMediaAction("prev")
                override fun onFastForward() = dispatchMediaAction("forward")
                override fun onRewind() = dispatchMediaAction("rewind")
                override fun onSetRepeatMode(repeatMode: Int) = dispatchMediaAction("repeat")
                override fun onSeekTo(pos: Long) {
                    updateSeekState(pos)
                    updateNotification()
                    MediaControlsModule.sendEvent("seek:${pos / 1000.0}")
                    notifyLockScreen()
                }
                override fun onCustomAction(action: String?, extras: Bundle?) {
                    when (action) {
                        ACTION_LIKE, "like" -> dispatchMediaAction("like")
                        ACTION_REPEAT, "repeat" -> dispatchMediaAction("repeat")
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
            ACTION_SHOW, ACTION_UPDATE -> {
                handlePlaybackIntent(intent)
                if (isPlaying) {
                    wakeLockHandler.removeCallbacks(wakeLockReleaseRunnable)
                    acquireWakeLock()
                    startForegroundWithNotification()
                } else {
                    wakeLockHandler.removeCallbacks(wakeLockReleaseRunnable)
                    wakeLockHandler.postDelayed(wakeLockReleaseRunnable, 15000L)
                    updateNotification()
                }
                notifyLockScreen()
            }
            ACTION_HIDE -> {
                dismissLockscreenNotification()
                LockScreenActivity.dismissIfShowing()
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
        return START_STICKY
    }

    private fun handlePlaybackIntent(intent: Intent) {
        val now = SystemClock.elapsedRealtime()
        val incomingTitle = intent.getStringExtra("title")
        val isTitleChanged = !incomingTitle.isNullOrBlank() && incomingTitle != currentTitle && currentTitle != "Rivo Music"
        if (!incomingTitle.isNullOrBlank() && (incomingTitle != "Unknown Track" || currentTitle == "Rivo Music")) {
            currentTitle = incomingTitle
        }

        val incomingArtist = intent.getStringExtra("artist")
        if (!incomingArtist.isNullOrBlank() && (incomingArtist != "Unknown Artist" || currentArtist == "Playing in Background")) {
            currentArtist = incomingArtist
        }

        val incomingCover = intent.getStringExtra("coverUrl")
        if (!incomingCover.isNullOrBlank()) {
            if (incomingCover != lastLoadedCoverUrl || currentBitmap == null) {
                currentCoverUrl = incomingCover
                lastLoadedCoverUrl = incomingCover
                MediaArtworkHelper.loadCoverBitmapAsync(incomingCover) { bmp ->
                    currentBitmap = bmp
                    updateNotification()
                    notifyLockScreen()
                }
            }
        } else {
            currentCoverUrl = null
            lastLoadedCoverUrl = null
            currentBitmap = null
        }

        if (intent.hasExtra("isPlaying")) {
            val newIsPlaying = intent.getBooleanExtra("isPlaying", isPlaying)
            if (newIsPlaying != isPlaying) {
                if (!newIsPlaying) currentPositionMs = getEstimatedPositionMs()
                lastPositionUpdateElapsedRealtime = SystemClock.elapsedRealtime()
                isPlaying = newIsPlaying
            }
        }
        if (now - lastUserRepeatTimeMs > 4000L) {
            val incomingRepeatMode = intent.getStringExtra("repeatMode")
            if (!incomingRepeatMode.isNullOrBlank()) repeatMode = incomingRepeatMode
            else if (intent.hasExtra("isRepeat")) repeatMode = if (intent.getBooleanExtra("isRepeat", false)) "all" else "off"
        }
        if (intent.hasExtra("isShuffle")) isShuffle = intent.getBooleanExtra("isShuffle", isShuffle)
        if (intent.hasExtra("isLiked") && (now - lastUserLikeTimeMs > 4000L)) isLiked = intent.getBooleanExtra("isLiked", isLiked)
        if (intent.hasExtra("duration")) {
            val dSec = intent.getDoubleExtra("duration", 0.0)
            if (dSec > 0) currentDurationMs = (dSec * 1000).toLong()
        }
        val incomingTimeSec = if (intent.hasExtra("currentTime")) intent.getDoubleExtra("currentTime", -1.0) else -1.0
        if (incomingTimeSec >= 0.0 && (now - lastUserSeekTimeMs > 3000L)) {
            currentPositionMs = (incomingTimeSec * 1000).toLong()
            lastPositionUpdateElapsedRealtime = SystemClock.elapsedRealtime()
        } else if (isTitleChanged) {
            currentPositionMs = 0L
            lastPositionUpdateElapsedRealtime = SystemClock.elapsedRealtime()
            LockScreenLyricsStore.clear()
        }
    }

    private fun dispatchMediaAction(action: String) {
        val now = SystemClock.elapsedRealtime()
        when (action) {
            "play" -> {
                if (!isPlaying) lastPositionUpdateElapsedRealtime = now
                isPlaying = true; acquireWakeLock(); startForegroundWithNotification()
            }
            "pause" -> {
                if (isPlaying) { currentPositionMs = getEstimatedPositionMs(); lastPositionUpdateElapsedRealtime = now }
                isPlaying = false; releaseWakeLock()
            }
            "repeat" -> {
                repeatMode = when (repeatMode) { "off" -> "all"; "all" -> "one"; else -> "off" }
                lastUserRepeatTimeMs = now
            }
            "shuffle" -> { isShuffle = !isShuffle }
            "like" -> { isLiked = !isLiked; lastUserLikeTimeMs = now }
        }
        updateNotification()
        MediaControlsModule.sendEvent(action)
        notifyLockScreen()
    }

    private fun notifyLockScreen() {
        try {
            LockScreenActivity.notifyPlaybackChanged()
            RivoWidgetManager.updateAll(this)
        } catch (_: Throwable) {}
    }

    private fun startForegroundWithNotification() {
        try {
            val notification = buildMediaNotification(false)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (_: Throwable) {
            try {
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, buildMediaNotification(false))
            } catch (_: Throwable) {}
        }
    }

    private fun updateNotification(withFullScreenLock: Boolean = false) {
        try {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(NOTIFICATION_ID, buildMediaNotification(withFullScreenLock))
        } catch (_: Throwable) {}
    }

    private fun buildMediaNotification(withFullScreenLock: Boolean): Notification {
        return MediaNotificationBuilder.build(
            context = this,
            mediaSession = mediaSession,
            title = currentTitle,
            artist = currentArtist,
            bitmap = currentBitmap,
            isPlaying = isPlaying,
            repeatMode = repeatMode,
            isLiked = isLiked,
            positionMs = getEstimatedPositionMs(),
            durationMs = currentDurationMs,
            withFullScreenLock = withFullScreenLock
        )
    }
}
