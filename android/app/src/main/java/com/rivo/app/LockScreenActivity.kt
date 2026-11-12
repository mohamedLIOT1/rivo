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
import kotlin.math.abs
import java.util.Locale

class LockScreenActivity : Activity() {

    companion object {
        var activeInstance: LockScreenActivity? = null

        fun notifyPlaybackChanged() {
            activeInstance?.runOnUiThread { activeInstance?.updateUi() }
        }

        fun notifyLyricsChanged() {
            activeInstance?.runOnUiThread {
                activeInstance?.updateLyricsUi()
                activeInstance?.lyricsSheet?.refresh()
            }
        }

        fun dismissIfShowing() {
            activeInstance?.runOnUiThread { activeInstance?.finish() }
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
    private var btnLyrics: ImageButton? = null
    private var queueSheet: LockScreenQueueSheet? = null
    private var lyricsSheet: LockScreenLyricsSheet? = null
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
        try {
            MediaNotificationService.instance?.dismissLockscreenNotification()
        } catch (_: Throwable) {}

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
        lyricsSheet = null
        super.onDestroy()
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (queueSheet?.isOpen() != true && lyricsSheet?.isOpen() != true && !isUserSeeking) {
            gestureDetector?.onTouchEvent(ev)
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    touchDownX = ev.rawX
                    touchDownY = ev.rawY
                }
                MotionEvent.ACTION_UP -> {
                    val diffY = touchDownY - ev.rawY
                    val diffX = abs(touchDownX - ev.rawX)
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
        btnLyrics = findViewById(R.id.btn_lock_lyrics)

        queueSheet = LockScreenQueueSheet(
            this,
            findViewById(R.id.lock_queue_sheet),
            findViewById(R.id.lock_queue_list),
            findViewById(R.id.lock_queue_count),
            findViewById(R.id.btn_lock_queue_close)
        )

        lyricsSheet = LockScreenLyricsSheet(
            this,
            findViewById(R.id.lock_lyrics_sheet),
            findViewById(R.id.lock_lyrics_list),
            findViewById(R.id.lock_lyrics_sync_status),
            findViewById(R.id.lock_lyrics_empty),
            findViewById(R.id.btn_lock_lyrics_close)
        )

        txtTitle?.isSelected = true

        gestureDetector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent): Boolean = true
            override fun onFling(e1: MotionEvent?, e2: MotionEvent, velocityX: Float, velocityY: Float): Boolean {
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
        btnClose?.setOnClickListener { dismissAndUnlock() }
        btnQueue?.setOnClickListener { lyricsSheet?.hide(); queueSheet?.show() }
        btnLyrics?.setOnClickListener { queueSheet?.hide(); lyricsSheet?.show() }
        txtLyrics?.setOnClickListener { queueSheet?.hide(); lyricsSheet?.show() }

        btnPlayPause?.setOnClickListener {
            MediaNotificationService.dispatchMediaActionStatic(
                if (MediaNotificationService.isPlaying) "pause" else "play"
            )
            updateUi()
        }
        btnNext?.setOnClickListener { MediaNotificationService.dispatchMediaActionStatic("next"); updateUi() }
        btnPrev?.setOnClickListener { MediaNotificationService.dispatchMediaActionStatic("prev"); updateUi() }
        btnShuffle?.setOnClickListener { MediaNotificationService.dispatchMediaActionStatic("shuffle"); updateUi() }
        btnRepeat?.setOnClickListener { MediaNotificationService.dispatchMediaActionStatic("repeat"); updateUi() }

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
                    MediaNotificationService.notifyLocalSeek(posMs)
                    MediaControlsModule.sendEvent("seek:${posMs / 1000.0}")
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

        btnPlayPause?.setImageResource(
            if (MediaNotificationService.isPlaying) R.drawable.ic_notification_pause
            else R.drawable.ic_notification_play
        )

        btnShuffle?.setColorFilter(
            if (MediaNotificationService.isShuffle) 0xFF17A398.toInt() else 0xFF94A3B8.toInt()
        )

        val (repeatRes, repeatColor) = when (MediaNotificationService.repeatMode) {
            "one" -> Pair(R.drawable.ic_notification_repeat_on, 0xFF17A398.toInt())
            "all" -> Pair(R.drawable.ic_notification_repeat_all, 0xFF17A398.toInt())
            else -> Pair(R.drawable.ic_notification_repeat, 0xFF94A3B8.toInt())
        }
        btnRepeat?.setImageResource(repeatRes)
        btnRepeat?.setColorFilter(repeatColor)

        val bmp: Bitmap? = MediaNotificationService.currentBitmap
        if (bmp != null) {
            imgCoverArt?.setImageBitmap(bmp)
            imgBgArt?.setImageBitmap(bmp)
        } else {
            imgCoverArt?.setImageResource(R.drawable.logo)
            imgBgArt?.setImageResource(R.drawable.logo)
        }

        queueSheet?.refresh()
        lyricsSheet?.refresh()
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
        lyricsSheet?.updateActivePosition(pos)

        // Keep lockscreen main view clean without cluttering inline lyrics under Artist Name;
        // full synced lyrics open strictly on demand via top-right btn_lock_lyrics -> LockScreenLyricsSheet.
        val lyricView = txtLyrics ?: return
        if (lyricView.visibility != View.GONE) {
            lyricView.visibility = View.GONE
            lyricView.text = ""
            lastLyricLine = null
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
        if (lyricsSheet?.isOpen() == true) {
            lyricsSheet?.hide()
            return
        }
        if (queueSheet?.isOpen() == true) {
            queueSheet?.hide()
            return
        }
        super.onBackPressed()
        finish()
    }
}
