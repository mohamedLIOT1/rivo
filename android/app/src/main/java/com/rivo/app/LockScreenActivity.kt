package com.rivo.app

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.SeekBar
import android.widget.TextView
import androidx.core.content.ContextCompat
import kotlin.math.abs
import java.util.Locale

class LockScreenActivity : Activity() {

    companion object {
        var activeInstance: LockScreenActivity? = null

        fun notifyPlaybackChanged() {
            activeInstance?.runOnUiThread {
                activeInstance?.updateUi()
            }
        }

        fun notifyLyricsChanged() {
            activeInstance?.runOnUiThread {
                activeInstance?.updateLyricsUi()
            }
        }

        fun dismissIfShowing() {
            activeInstance?.runOnUiThread {
                activeInstance?.finish()
            }
        }
    }

    private var imgBgArt: ImageView? = null
    private var imgCoverArt: ImageView? = null
    private var txtTitle: TextView? = null
    private var txtArtist: TextView? = null
    private var txtLyrics: TextView? = null
    private var lastLyricLine: String? = null
    private var txtTimeCurrent: TextView? = null
    private var txtTimeTotal: TextView? = null
    private var seekProgress: SeekBar? = null
    private var btnShuffle: ImageButton? = null
    private var btnPrev: ImageButton? = null
    private var btnPlayPause: ImageButton? = null
    private var btnNext: ImageButton? = null
    private var btnRepeat: ImageButton? = null
    private var btnClose: ImageButton? = null
    private var btnQueue: ImageButton? = null
    private var queueSheet: LockScreenQueueSheet? = null
    private var gestureDetector: GestureDetector? = null

    private val progressHandler = Handler(Looper.getMainLooper())
    private var isUserSeeking = false
    private var touchDownX = 0f
    private var touchDownY = 0f

    private val progressRunnable = object : Runnable {
        override fun run() {
            if (!isUserSeeking && MediaNotificationService.isPlaying) {
                updateProgressUi()
            }
            progressHandler.postDelayed(this, 500L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        activeInstance = this

        setupLockScreenWindow()
        setContentView(R.layout.activity_lock_screen)

        initViews()
        setupListeners()
        updateUi()
    }

    override fun onResume() {
        super.onResume()
        activeInstance = this

        // Clear the launcher notification once the activity is in foreground
        try {
            MediaNotificationService.instance?.dismissLockscreenNotification()
        } catch (_: Throwable) {}

        // If playback stopped while locked, dismiss activity
        if (!MediaNotificationService.isPlaying) {
            finish()
            return
        }
        updateUi()
        progressHandler.removeCallbacks(progressRunnable)
        progressHandler.post(progressRunnable)
    }

    override fun onPause() {
        progressHandler.removeCallbacks(progressRunnable)
        super.onPause()
    }

    override fun onDestroy() {
        if (activeInstance == this) activeInstance = null
        progressHandler.removeCallbacks(progressRunnable)
        queueSheet = null
        super.onDestroy()
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (queueSheet?.isOpen() != true && !isUserSeeking) {
            gestureDetector?.onTouchEvent(ev)
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    touchDownX = ev.rawX
                    touchDownY = ev.rawY
                }
                MotionEvent.ACTION_UP -> {
                    val diffY = touchDownY - ev.rawY
                    val diffX = abs(touchDownX - ev.rawX)
                    // Support slow deliberate upward swipe anywhere on screen in addition to fast flings
                    if (diffY > 200f && diffY > diffX * 1.4f) {
                        dismissAndUnlock()
                        return true
                    }
                }
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    private fun setupLockScreenWindow() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        )
    }

    private fun initViews() {
        imgBgArt = findViewById(R.id.lock_bg_art)
        imgCoverArt = findViewById(R.id.lock_cover_art)
        txtTitle = findViewById(R.id.lock_title)
        txtArtist = findViewById(R.id.lock_artist)
        txtLyrics = findViewById(R.id.lock_lyrics_line)
        txtTimeCurrent = findViewById(R.id.lock_time_current)
        txtTimeTotal = findViewById(R.id.lock_time_total)
        seekProgress = findViewById(R.id.lock_seekbar)
        btnShuffle = findViewById(R.id.btn_lock_shuffle)
        btnPrev = findViewById(R.id.btn_lock_prev)
        btnPlayPause = findViewById(R.id.btn_lock_play_pause)
        btnNext = findViewById(R.id.btn_lock_next)
        btnRepeat = findViewById(R.id.btn_lock_repeat)
        btnClose = findViewById(R.id.btn_lock_close)
        btnQueue = findViewById(R.id.btn_lock_queue)

        queueSheet = LockScreenQueueSheet(
            this,
            findViewById(R.id.lock_queue_sheet),
            findViewById(R.id.lock_queue_list),
            findViewById(R.id.lock_queue_count),
            findViewById(R.id.btn_lock_queue_close)
        )

        txtTitle?.isSelected = true // Enable marquee horizontal scroll

        // Swipe up or swipe down gesture to unlock / dismiss
        gestureDetector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent): Boolean = true

            override fun onFling(
                e1: MotionEvent?,
                e2: MotionEvent,
                velocityX: Float,
                velocityY: Float
            ): Boolean {
                if (e1 != null) {
                    val diffY = e2.y - e1.y
                    val diffX = e2.x - e1.x
                    if (abs(diffY) > abs(diffX) && abs(diffY) > 80 && abs(velocityY) > 150) {
                        dismissAndUnlock()
                        return true
                    }
                }
                return false
            }
        })
    }

    private fun setupListeners() {
        btnClose?.setOnClickListener {
            dismissAndUnlock()
        }

        btnQueue?.setOnClickListener {
            queueSheet?.show()
        }

        btnPlayPause?.setOnClickListener {
            MediaNotificationService.dispatchMediaActionStatic(
                if (MediaNotificationService.isPlaying) "pause" else "play"
            )
            updateUi()
        }

        btnNext?.setOnClickListener {
            MediaNotificationService.dispatchMediaActionStatic("next")
            updateUi()
        }

        btnPrev?.setOnClickListener {
            MediaNotificationService.dispatchMediaActionStatic("prev")
            updateUi()
        }

        btnShuffle?.setOnClickListener {
            MediaNotificationService.dispatchMediaActionStatic("shuffle")
            updateUi()
        }

        btnRepeat?.setOnClickListener {
            MediaNotificationService.dispatchMediaActionStatic("repeat")
            updateUi()
        }

        seekProgress?.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar?, prog: Int, fromUser: Boolean) {
                if (fromUser && MediaNotificationService.currentDurationMs > 0) {
                    val pos = (prog.toDouble() / 1000.0 * MediaNotificationService.currentDurationMs).toLong()
                    txtTimeCurrent?.text = formatTime(pos)
                    updateLyricsUi(pos)
                }
            }

            override fun onStartTrackingTouch(sb: SeekBar?) {
                isUserSeeking = true
            }

            override fun onStopTrackingTouch(sb: SeekBar?) {
                isUserSeeking = false
                val prog = sb?.progress ?: 0
                if (MediaNotificationService.currentDurationMs > 0) {
                    val posMs = (prog.toDouble() / 1000.0 * MediaNotificationService.currentDurationMs).toLong()
                    val posSeconds = posMs / 1000.0
                    MediaNotificationService.notifyLocalSeek(posMs)
                    // Dispatch seek event with seconds parameter to React Native
                    MediaControlsModule.sendEvent("seek:$posSeconds")
                }
            }
        })
    }

    private fun dismissAndUnlock() {
        try {
            val km = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                km?.requestDismissKeyguard(this, null)
            }
        } catch (_: Throwable) {}
        finish()
    }

    fun updateUi() {
        txtTitle?.text = MediaNotificationService.currentTitle
        txtArtist?.text = MediaNotificationService.currentArtist

        // Update Play / Pause Icon
        btnPlayPause?.setImageResource(
            if (MediaNotificationService.isPlaying) R.drawable.ic_notification_pause
            else R.drawable.ic_notification_play
        )

        // Update Shuffle Tint (Teal active vs Slate inactive)
        btnShuffle?.setColorFilter(
            if (MediaNotificationService.isShuffle) 0xFF17A398.toInt() else 0xFF94A3B8.toInt()
        )

        // Update Repeat Icon & Tint
        val repeatRes = when (MediaNotificationService.repeatMode) {
            "one" -> R.drawable.ic_notification_repeat_on
            "all" -> R.drawable.ic_notification_repeat_all
            else -> R.drawable.ic_notification_repeat
        }
        btnRepeat?.setImageResource(repeatRes)
        btnRepeat?.setColorFilter(
            if (MediaNotificationService.repeatMode != "off") 0xFF17A398.toInt() else 0xFF94A3B8.toInt()
        )

        // Artwork
        val bmp: Bitmap? = MediaNotificationService.currentBitmap
        if (bmp != null) {
            imgCoverArt?.setImageBitmap(bmp)
            imgBgArt?.setImageBitmap(bmp)
        } else {
            imgCoverArt?.setImageResource(R.drawable.logo)
            imgBgArt?.setImageResource(R.drawable.logo)
        }

        queueSheet?.refresh()
        updateProgressUi()
    }

    private fun updateProgressUi() {
        val dur = MediaNotificationService.currentDurationMs
        val pos = MediaNotificationService.getEstimatedPositionMs()

        txtTimeCurrent?.text = formatTime(pos)
        txtTimeTotal?.text = formatTime(dur)

        if (!isUserSeeking && dur > 0) {
            val pct = ((pos.toDouble() / dur.toDouble()) * 1000.0).toInt().coerceIn(0, 1000)
            seekProgress?.progress = pct
        }

        updateLyricsUi(pos)
    }

    fun updateLyricsUi(pos: Long = MediaNotificationService.getEstimatedPositionMs()) {
        val lyricView = txtLyrics ?: return
        val activeLine = LockScreenLyricsStore.getActiveLyric(pos)

        if (activeLine.isNullOrBlank()) {
            if (lyricView.visibility != View.GONE) {
                lyricView.visibility = View.GONE
                lyricView.text = ""
                lastLyricLine = null
            }
            return
        }

        if (activeLine != lastLyricLine) {
            lastLyricLine = activeLine
            lyricView.text = activeLine
            if (lyricView.visibility != View.VISIBLE) {
                lyricView.alpha = 0f
                lyricView.visibility = View.VISIBLE
                lyricView.animate().alpha(1f).setDuration(220).start()
            }
        }
    }

    private fun formatTime(ms: Long): String {
        val totalSec = (ms / 1000L).coerceAtLeast(0L)
        val m = totalSec / 60
        val s = totalSec % 60
        return String.format(Locale.US, "%d:%02d", m, s)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (queueSheet?.isOpen() == true) {
            queueSheet?.hide()
            return
        }
        super.onBackPressed()
        finish()
    }
}
