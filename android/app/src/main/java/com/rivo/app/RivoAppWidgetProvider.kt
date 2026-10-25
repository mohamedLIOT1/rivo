package com.rivo.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.widget.RemoteViews

object RivoWidgetManager {
    fun updateAll(context: Context) {
        val appWidgetManager = AppWidgetManager.getInstance(context)

        // Update 4x1 Widgets
        val ids4x1 = appWidgetManager.getAppWidgetIds(ComponentName(context, RivoAppWidget4x1::class.java))
        if (ids4x1.isNotEmpty()) {
            val views4x1 = build4x1Views(context)
            for (id in ids4x1) {
                appWidgetManager.updateAppWidget(id, views4x1)
            }
        }

        // Update 4x2 Widgets
        val ids4x2 = appWidgetManager.getAppWidgetIds(ComponentName(context, RivoAppWidget4x2::class.java))
        if (ids4x2.isNotEmpty()) {
            val views4x2 = build4x2Views(context)
            for (id in ids4x2) {
                appWidgetManager.updateAppWidget(id, views4x2)
            }
        }
    }

    private fun getPendingServiceIntent(context: Context, action: String, requestCode: Int): PendingIntent {
        val intent = Intent(context, MediaNotificationService::class.java).apply {
            this.action = action
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getService(context, requestCode, intent, flags)
    }

    private fun getOpenAppIntent(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getActivity(context, 100, intent, flags)
    }

    private fun build4x1Views(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_4x1)

        views.setTextViewText(R.id.widget_41_title, MediaNotificationService.currentTitle)
        views.setTextViewText(R.id.widget_41_artist, MediaNotificationService.currentArtist)

        // Artwork
        val bmp: Bitmap? = MediaNotificationService.currentBitmap
        if (bmp != null) {
            views.setImageViewBitmap(R.id.widget_41_art, bmp)
        } else {
            views.setImageViewResource(R.id.widget_41_art, R.drawable.logo)
        }

        // Play/Pause icon
        views.setImageViewResource(
            R.id.widget_41_btn_play_pause,
            if (MediaNotificationService.isPlaying) R.drawable.ic_notification_pause
            else R.drawable.ic_notification_play
        )

        // PendingIntents
        views.setOnClickPendingIntent(R.id.widget_41_art, getOpenAppIntent(context))
        views.setOnClickPendingIntent(R.id.widget_41_btn_play_pause, getPendingServiceIntent(context, MediaNotificationService.ACTION_PLAY_PAUSE, 101))
        views.setOnClickPendingIntent(R.id.widget_41_btn_next, getPendingServiceIntent(context, MediaNotificationService.ACTION_NEXT, 102))
        views.setOnClickPendingIntent(R.id.widget_41_btn_prev, getPendingServiceIntent(context, MediaNotificationService.ACTION_PREV, 103))

        return views
    }

    private fun build4x2Views(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_4x2)

        views.setTextViewText(R.id.widget_42_title, MediaNotificationService.currentTitle)
        views.setTextViewText(R.id.widget_42_artist, MediaNotificationService.currentArtist)

        val bmp: Bitmap? = MediaNotificationService.currentBitmap
        if (bmp != null) {
            views.setImageViewBitmap(R.id.widget_42_art, bmp)
        } else {
            views.setImageViewResource(R.id.widget_42_art, R.drawable.logo)
        }

        views.setImageViewResource(
            R.id.widget_42_btn_play_pause,
            if (MediaNotificationService.isPlaying) R.drawable.ic_notification_pause
            else R.drawable.ic_notification_play
        )

        // Visual states for Shuffle, Repeat, and Like
        views.setInt(
            R.id.widget_42_btn_shuffle,
            "setColorFilter",
            if (MediaNotificationService.isShuffle) 0xFF17A398.toInt() else 0xFF94A3B8.toInt()
        )

        val repeatRes = when (MediaNotificationService.repeatMode) {
            "one" -> R.drawable.ic_notification_repeat_on
            "all" -> R.drawable.ic_notification_repeat_all
            else -> R.drawable.ic_notification_repeat
        }
        views.setImageViewResource(R.id.widget_42_btn_repeat, repeatRes)
        views.setInt(
            R.id.widget_42_btn_repeat,
            "setColorFilter",
            if (MediaNotificationService.repeatMode != "off") 0xFF17A398.toInt() else 0xFF94A3B8.toInt()
        )

        views.setImageViewResource(
            R.id.widget_42_btn_like,
            if (MediaNotificationService.isLiked) R.drawable.ic_notification_liked else R.drawable.ic_notification_like
        )
        views.setInt(
            R.id.widget_42_btn_like,
            "setColorFilter",
            if (MediaNotificationService.isLiked) 0xFFE11D48.toInt() else 0xFF94A3B8.toInt()
        )

        views.setOnClickPendingIntent(R.id.widget_42_art, getOpenAppIntent(context))
        views.setOnClickPendingIntent(R.id.widget_42_btn_play_pause, getPendingServiceIntent(context, MediaNotificationService.ACTION_PLAY_PAUSE, 201))
        views.setOnClickPendingIntent(R.id.widget_42_btn_next, getPendingServiceIntent(context, MediaNotificationService.ACTION_NEXT, 202))
        views.setOnClickPendingIntent(R.id.widget_42_btn_prev, getPendingServiceIntent(context, MediaNotificationService.ACTION_PREV, 203))
        views.setOnClickPendingIntent(R.id.widget_42_btn_shuffle, getPendingServiceIntent(context, MediaNotificationService.ACTION_SHUFFLE, 204))
        views.setOnClickPendingIntent(R.id.widget_42_btn_repeat, getPendingServiceIntent(context, MediaNotificationService.ACTION_REPEAT, 205))
        views.setOnClickPendingIntent(R.id.widget_42_btn_like, getPendingServiceIntent(context, MediaNotificationService.ACTION_LIKE, 206))

        return views
    }
}

class RivoAppWidget4x1 : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        RivoWidgetManager.updateAll(context)
    }
}

class RivoAppWidget4x2 : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        RivoWidgetManager.updateAll(context)
    }
}
