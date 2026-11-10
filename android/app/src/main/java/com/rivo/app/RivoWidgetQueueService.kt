package com.rivo.app

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService

class RivoWidgetQueueService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return RivoWidgetQueueFactory(applicationContext, intent)
    }
}

class RivoWidgetQueueFactory(
    private val context: Context,
    private val intent: Intent
) : RemoteViewsService.RemoteViewsFactory {

    private var items: List<LockScreenQueueItem> = emptyList()

    override fun onCreate() {
        loadData()
    }

    override fun onDataSetChanged() {
        loadData()
    }

    private fun loadData() {
        items = LockScreenQueueStore.items
    }

    override fun onDestroy() {
        items = emptyList()
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews? {
        if (position < 0 || position >= items.size) return null
        val item = items[position]

        val views = RemoteViews(context.packageName, R.layout.widget_queue_item)
        views.setTextViewText(R.id.widget_queue_item_index, "${position + 1}")
        views.setTextViewText(R.id.widget_queue_item_title, item.title)
        views.setTextViewText(R.id.widget_queue_item_artist, item.artist)

        if (item.isCurrent) {
            views.setTextColor(R.id.widget_queue_item_title, Color.parseColor("#2DD4BF"))
            views.setTextColor(R.id.widget_queue_item_index, Color.parseColor("#2DD4BF"))
            views.setViewVisibility(R.id.widget_queue_item_playing, View.VISIBLE)
        } else {
            views.setTextColor(R.id.widget_queue_item_title, Color.parseColor("#FFFFFF"))
            views.setTextColor(R.id.widget_queue_item_index, Color.parseColor("#64748B"))
            views.setViewVisibility(R.id.widget_queue_item_playing, View.GONE)
        }

        val fillInIntent = Intent().apply {
            putExtra(RivoAppWidget4x2.EXTRA_QUEUE_INDEX, item.index)
            putExtra(RivoAppWidget4x2.EXTRA_TRACK_ID, item.id)
        }
        views.setOnClickFillInIntent(R.id.widget_queue_item_container, fillInIntent)

        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = false
}
