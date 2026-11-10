package com.rivo.app

import android.app.Activity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.widget.BaseAdapter
import android.widget.ImageButton
import android.widget.ListView
import android.widget.TextView

class LockScreenQueueSheet(
    private val activity: Activity,
    private val sheetRoot: View?,
    private val listView: ListView?,
    private val txtCount: TextView?,
    private val btnClose: ImageButton?
) {
    private var currentItems: List<LockScreenQueueItem> = emptyList()
    private var isSheetOpen: Boolean = false
    private val adapter = QueueAdapter()

    init {
        listView?.adapter = adapter
        btnClose?.setOnClickListener { hide() }
        listView?.setOnItemClickListener { _, _, position, _ ->
            val item = currentItems.getOrNull(position) ?: return@setOnItemClickListener
            MediaControlsModule.sendEvent("play_queue_index:${item.index}")
            LockScreenQueueStore.items = LockScreenQueueStore.items.map { entry ->
                entry.copy(isCurrent = entry.index == item.index)
            }
            refresh()
            hide()
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

        val activeIndex = currentItems.indexOfFirst { it.isCurrent }
        if (activeIndex >= 0) {
            listView?.post {
                listView.setSelection(activeIndex)
            }
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

    fun refresh() {
        currentItems = LockScreenQueueStore.items
        val count = currentItems.size
        txtCount?.text = "$count track${if (count == 1) "" else "s"}"
        adapter.notifyDataSetChanged()
    }

    fun isOpen(): Boolean {
        return isSheetOpen && sheetRoot?.visibility == View.VISIBLE
    }

    private class ViewHolder(
        val txtIndex: TextView,
        val txtTitle: TextView,
        val txtArtist: TextView,
        val txtPlayingTag: TextView
    )

    private inner class QueueAdapter : BaseAdapter() {
        private val inflater: LayoutInflater = LayoutInflater.from(activity)

        override fun getCount(): Int = currentItems.size

        override fun getItem(position: Int): LockScreenQueueItem = currentItems[position]

        override fun getItemId(position: Int): Long = position.toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
            val rowView: View
            val holder: ViewHolder

            if (convertView == null) {
                rowView = inflater.inflate(R.layout.lock_queue_item, parent, false)
                holder = ViewHolder(
                    txtIndex = rowView.findViewById(R.id.queue_item_index),
                    txtTitle = rowView.findViewById(R.id.queue_item_title),
                    txtArtist = rowView.findViewById(R.id.queue_item_artist),
                    txtPlayingTag = rowView.findViewById(R.id.queue_item_playing_tag)
                )
                rowView.tag = holder
            } else {
                rowView = convertView
                holder = rowView.tag as ViewHolder
            }

            val item = currentItems[position]
            holder.txtTitle.text = item.title
            holder.txtArtist.text = item.artist

            if (item.isCurrent) {
                holder.txtIndex.text = "▶"
                holder.txtIndex.setTextColor(COLOR_TEAL)
                holder.txtTitle.setTextColor(COLOR_TEAL)
                holder.txtPlayingTag.visibility = View.VISIBLE
            } else {
                holder.txtIndex.text = (item.index + 1).toString()
                holder.txtIndex.setTextColor(COLOR_SLATE)
                holder.txtTitle.setTextColor(COLOR_WHITE)
                holder.txtPlayingTag.visibility = View.GONE
            }

            return rowView
        }
    }

    companion object {
        private const val COLOR_TEAL = 0xFF17A398.toInt()
        private const val COLOR_SLATE = 0xFF94A3B8.toInt()
        private const val COLOR_WHITE = 0xFFFFFFFF.toInt()
    }
}
