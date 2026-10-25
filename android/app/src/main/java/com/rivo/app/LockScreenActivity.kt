package com.rivo.app

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.SeekBar
import android.widget.TextView
import java.util.Locale

class LockScreenActivity : Activity() {

    companion object {
        var activeInstance: LockScreenActivity? = null

        fun notifyPlaybackChanged() {
            activeInstance?.runOnUiThread {
                activeInstance?.updateUi()
            }
        }
    }

    private var imgBgArt: ImageView? = null
    private var imgCoverArt: ImageView? = null
    private var txtTitle: TextView? = null
    private var txtArtist: TextView? = null
    private var txtTimeCurrent: TextView? = null
    private var txtTimeTotal: TextView? = null
    private var seekProgress: SeekBar? = null
    private var btnShuffle: ImageButton? = null
    private var btnPrev: ImageButton? = null
    private var btnPlayPause: ImageButton? = null
    private var btnNext: ImageButton? = null
    private var btnRepeat: ImageButton? = null
    private var unlockSeekbar: SeekBar? = null

    private val progressHandler = Handler(Looper.getMainLooper())
    private var isUserSeeking = false

    private val progressRunnable = object : Runnable {
        override fun run() {
            if (!isUserSeeking && MediaNotificationService.isPlaying) {
                if (MediaNotificationService.currentDurationMs > 0) {
                    MediaNotificationService.currentPositionMs += 1000L
                    if (MediaNotificationService.currentPositionMs > MediaNotificationService.currentDurationMs) {
                        MediaNotificationService.currentPositionMs = MediaNotificationService.currentDurationMs
                    }
                    updateProgressUi()
                }
            }
            progressHandler.postDelayed(this, 1000L)
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
        updateUi()
        progressHandler.post(progressRunnable)
    }

    override fun onPause() {
        progressHandler.removeCallbacks(progressRunnable)
        super.onPause()
    }

    override fun onDestroy() {
        if (activeInstance == this) activeInstance = null
        progressHandler.removeCallbacks(progressRunnable)
        super.onDestroy()
    }

    private fun setupLockScreenWindow() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

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
        txtTimeCurrent = findViewById(R.id.lock_time_current)
        txtTimeTotal = findViewById(R.id.lock_time_total)
        seekProgress = findViewById(R.id.lock_seekbar)
        btnShuffle = findViewById(R.id.btn_lock_shuffle)
        btnPrev = findViewById(R.id.btn_lock_prev)
        btnPlayPause = findViewById(R.id.btn_lock_play_pause)
        btnNext = findViewById(R.id.btn_lock_next)
        btnRepeat = findViewById(R.id.btn_lock_repeat)
        unlockSeekbar = findViewById(R.id.lock_unlock_seekbar)

        txtTitle?.isSelected = true // Enable marquee
    }

    private fun setupListeners() {
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
                    MediaNotificationService.currentPositionMs = posMs
                    // In a production seek, dispatches forward/seek to audio engine
                }
            }
        })

        // Slide to unlock listener
        unlockSeekbar?.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar?, prog: Int, fromUser: Boolean) {
                if (prog >= 85) {
                    unlockAndDismiss()
                }
            }

            override fun onStartTrackingTouch(sb: SeekBar?) {}

            override fun onStopTrackingTouch(sb: SeekBar?) {
                if ((sb?.progress ?: 0) < 85) {
                    sb?.progress = 0
                }
            }
        })
    }

    private fun unlockAndDismiss() {
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

        // Update Shuffle Tint
        btnShuffle?.setColorFilter(
            if (MediaNotificationService.isShuffle) 0xFF2DD4BF.toInt() else 0xFF94A3B8.toInt()
        )

        // Update Repeat Tint
        val repeatRes = when (MediaNotificationService.repeatMode) {
            "one" -> R.drawable.ic_notification_repeat_on
            "all" -> R.drawable.ic_notification_repeat_all
            else -> R.drawable.ic_notification_repeat
        }
        btnRepeat?.setImageResource(repeatRes)
        btnRepeat?.setColorFilter(
            if (MediaNotificationService.repeatMode != "off") 0xFF2DD4BF.toInt() else 0xFF94A3B8.toInt()
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

        updateProgressUi()
    }

    private fun updateProgressUi() {
        val dur = MediaNotificationService.currentDurationMs
        val pos = MediaNotificationService.currentPositionMs

        txtTimeCurrent?.text = formatTime(pos)
        txtTimeTotal?.text = formatTime(dur)

        if (!isUserSeeking && dur > 0) {
            val pct = ((pos.toDouble() / dur.toDouble()) * 1000.0).toInt().coerceIn(0, 1000)
            seekProgress?.progress = pct
        }
    }

    private fun formatTime(ms: Long): String {
        val totalSec = (ms / 1000L).coerceAtLeast(0L)
        val m = totalSec / 60
        val s = totalSec % 60
        return String.format(Locale.US, "%d:%02d", m, s)
    }

    override fun onBackPressed() {
        // Smoothly dismiss on back
        finish()
    }
}
