package com.rivo.app

import android.app.Activity
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.widget.AbsListView
import android.widget.BaseAdapter
import android.widget.ImageButton
import android.widget.ListView
import android.widget.TextView
import java.util.Locale

class LockScreenLyricsSheet(
    private val activity: Activity,
    private val sheetRoot: View?,
    private val listView: ListView?,
    private val txtSyncStatus: TextView?,
    private val emptyView: TextView?,
    private val btnClose: ImageButton?
) {
    private var isSheetOpen = false
    private var activeIndex = -1
    private var isUserScrolling = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private val resumeAutoScrollRunnable = Runnable { isUserScrolling = false }
    private val adapter = LyricsAdapter()

    init {
        listView?.adapter = adapter
        btnClose?.setOnClickListener { hide() }
        sheetRoot?.setOnClickListener { /* Prevent click-through */ }

        listView?.setOnScrollListener(object : AbsListView.OnScrollListener {
            override fun onScrollStateChanged(view: AbsListView?, scrollState: Int) {
                if (scrollState == AbsListView.OnScrollListener.SCROLL_STATE_TOUCH_SCROLL) {
                    isUserScrolling = true
                    mainHandler.removeCallbacks(resumeAutoScrollRunnable)
                } else if (scrollState == AbsListView.OnScrollListener.SCROLL_STATE_IDLE) {
                    mainHandler.removeCallbacks(resumeAutoScrollRunnable)
                    mainHandler.postDelayed(resumeAutoScrollRunnable, 3000L)
                }
            }

            override fun onScroll(view: AbsListView?, firstVisibleItem: Int, visibleItemCount: Int, totalItemCount: Int) {}
        })

        listView?.setOnItemClickListener { _, _, position, _ ->
            val items = LockScreenLyricsStore.currentLyrics
            val item = items.getOrNull(position) ?: return@setOnItemClickListener
            if (item.timeMs >= 0L) {
                val posSeconds = item.timeMs / 1000.0
                MediaNotificationService.notifyLocalSeek(item.timeMs)
                MediaControlsModule.sendEvent("seek:$posSeconds")
                activeIndex = position
                adapter.notifyDataSetChanged()
                scrollToActive(smooth = true)
            }
        }
    }

    fun show() {
        refresh()
        val root = sheetRoot ?: return
        isSheetOpen = true
        root.animate().cancel()
        root.visibility = View.VISIBLE
        root.translationY = 600f
        root.animate()
            .translationY(0f)
            .setDuration(220L)
            .setInterpolator(DecelerateInterpolator())
            .start()

        listView?.post {
            scrollToActive(smooth = false)
        }
    }

    fun hide() {
        isSheetOpen = false
        val root = sheetRoot ?: return
        if (root.visibility != View.VISIBLE) return
        root.animate().cancel()
        root.animate()
            .translationY(600f)
            .setDuration(200L)
            .setInterpolator(AccelerateInterpolator())
            .withEndAction {
                if (!isSheetOpen) {
                    root.visibility = View.GONE
                    root.translationY = 0f
                }
            }
            .start()
    }

    fun isOpen(): Boolean {
        return isSheetOpen && sheetRoot?.visibility == View.VISIBLE
    }

    fun refresh() {
        val items = LockScreenLyricsStore.currentLyrics
        val hasLyrics = items.isNotEmpty()

        if (hasLyrics) {
            emptyView?.visibility = View.GONE
            listView?.visibility = View.VISIBLE
            val isSynced = LockScreenLyricsStore.hasSyncedLyrics()
            txtSyncStatus?.text = if (isSynced) "Synced • Tap to jump" else "Lyrics"
        } else {
            emptyView?.visibility = View.GONE
            listView?.visibility = View.GONE
            txtSyncStatus?.text = "No lyrics"
        }

        val estimatedPos = MediaNotificationService.getEstimatedPositionMs()
        activeIndex = LockScreenLyricsStore.getActiveLyricIndex(estimatedPos)
        adapter.notifyDataSetChanged()
    }

    fun updateActivePosition(posMs: Long) {
        val newIndex = LockScreenLyricsStore.getActiveLyricIndex(posMs)
        if (newIndex != activeIndex) {
            activeIndex = newIndex
            adapter.notifyDataSetChanged()
            if (isSheetOpen && !isUserScrolling) {
                scrollToActive(smooth = true)
            }
        }
    }

    private fun scrollToActive(smooth: Boolean) {
        val list = listView ?: return
        if (activeIndex !in 0 until adapter.count) return
        val offset = (list.height * 0.33f).toInt().coerceAtLeast(0)
        if (smooth) {
            list.smoothScrollToPositionFromTop(activeIndex, offset, 300)
        } else {
            list.setSelectionFromTop(activeIndex, offset)
        }
    }

    private class ViewHolder(
        val txtText: TextView,
        val txtTime: TextView
    )

    private inner class LyricsAdapter : BaseAdapter() {
        private val inflater: LayoutInflater = LayoutInflater.from(activity)

        override fun getCount(): Int = LockScreenLyricsStore.currentLyrics.size

        override fun getItem(position: Int): LyricEntry = LockScreenLyricsStore.currentLyrics[position]

        override fun getItemId(position: Int): Long = position.toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
            val rowView: View
            val holder: ViewHolder

            if (convertView == null) {
                rowView = inflater.inflate(R.layout.lock_lyrics_item, parent, false)
                holder = ViewHolder(
                    txtText = rowView.findViewById(R.id.lyrics_item_text),
                    txtTime = rowView.findViewById(R.id.lyrics_item_time)
                )
                rowView.tag = holder
            } else {
                rowView = convertView
                holder = rowView.tag as ViewHolder
            }

            val item = LockScreenLyricsStore.currentLyrics[position]
            holder.txtText.text = item.text

            val isActive = position == activeIndex
            if (isActive) {
                holder.txtText.setTextColor(COLOR_ACTIVE)
                holder.txtText.setTypeface(null, Typeface.BOLD)
                holder.txtText.textSize = 17.5f
                holder.txtText.alpha = 1.0f
                if (item.timeMs >= 0L) {
                    holder.txtTime.visibility = View.VISIBLE
                    holder.txtTime.setTextColor(COLOR_ACTIVE)
                    holder.txtTime.text = formatTime(item.timeMs)
                    holder.txtTime.alpha = 0.85f
                } else {
                    holder.txtTime.visibility = View.GONE
                }
            } else {
                val isPast = activeIndex >= 0 && position < activeIndex
                holder.txtText.setTextColor(COLOR_INACTIVE)
                holder.txtText.setTypeface(null, Typeface.NORMAL)
                holder.txtText.textSize = 15.5f
                holder.txtText.alpha = if (isPast) 0.5f else 0.85f
                if (item.timeMs >= 0L) {
                    holder.txtTime.visibility = View.VISIBLE
                    holder.txtTime.setTextColor(COLOR_TIME_DIM)
                    holder.txtTime.text = formatTime(item.timeMs)
                    holder.txtTime.alpha = 0.5f
                } else {
                    holder.txtTime.visibility = View.GONE
                }
            }

            return rowView
        }
    }

    private fun formatTime(ms: Long): String {
        val totalSec = (ms / 1000L).coerceAtLeast(0L)
        val m = totalSec / 60
        val s = totalSec % 60
        return String.format(Locale.US, "%d:%02d", m, s)
    }

    companion object {
        private const val COLOR_ACTIVE = 0xFF2DD4BF.toInt()
        private const val COLOR_INACTIVE = 0xFFFFFFFF.toInt()
        private const val COLOR_TIME_DIM = 0xFF94A3B8.toInt()
    }
}
