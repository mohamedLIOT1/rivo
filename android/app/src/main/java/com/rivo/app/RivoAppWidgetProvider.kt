package com.rivo.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.util.Log
import android.widget.RemoteViews

object RivoWidgetManager {
    private const val TAG = "RivoWidgetManager"

    fun updateAll(context: Context) {
        val appWidgetManager = try {
            AppWidgetManager.getInstance(context)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to acquire AppWidgetManager", e)
            return
        } ?: return

        updateWidgetGroup(context, appWidgetManager, RivoAppWidget4x1::class.java, ::build4x1Views)
        updateWidgetGroup(context, appWidgetManager, RivoAppWidget4x2::class.java, ::build4x2Views)
    }

    private fun updateWidgetGroup(
        context: Context,
        appWidgetManager: AppWidgetManager,
        providerClass: Class<out AppWidgetProvider>,
        builder: (Context) -> RemoteViews
    ) {
        try {
            val ids = appWidgetManager.getAppWidgetIds(ComponentName(context, providerClass))
            if (ids.isEmpty()) return
            val views = builder(context)
            for (id in ids) {
                appWidgetManager.updateAppWidget(id, views)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update ${providerClass.simpleName}", e)
        }
    }

    private fun applyArtwork(views: RemoteViews, viewId: Int, bmp: Bitmap?) {
        if (bmp != null && !bmp.isRecycled) {
            views.setImageViewBitmap(viewId, bmp)
        } else {
            views.setImageViewResource(viewId, R.drawable.logo)
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

        try {
            views.setTextViewText(R.id.widget_41_title, MediaNotificationService.currentTitle)
            views.setTextViewText(R.id.widget_41_artist, MediaNotificationService.currentArtist)

            // Artwork
            applyArtwork(views, R.id.widget_41_art, MediaNotificationService.currentBitmap)

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
        } catch (e: Exception) {
            Log.e(TAG, "Failed to populate 4x1 widget views", e)
        }

        return views
    }

    private fun build4x2Views(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_4x2)

        try {
            views.setTextViewText(R.id.widget_42_title, MediaNotificationService.currentTitle)
            views.setTextViewText(R.id.widget_42_artist, MediaNotificationService.currentArtist)

            applyArtwork(views, R.id.widget_42_art, MediaNotificationService.currentBitmap)

            views.setImageViewResource(
                R.id.widget_42_btn_play_pause,
                if (MediaNotificationService.isPlaying) R.drawable.ic_widget_pause_dark
                else R.drawable.ic_widget_play_dark
            )

            // Visual states for Shuffle, Repeat, and Like using pre-tinted vector drawables (no RemoteViews reflection)
            views.setImageViewResource(
                R.id.widget_42_btn_shuffle,
                if (MediaNotificationService.isShuffle) R.drawable.ic_widget_shuffle_on
                else R.drawable.ic_widget_shuffle_off
            )

            val repeatRes = when (MediaNotificationService.repeatMode) {
                "one" -> R.drawable.ic_widget_repeat_one
                "all" -> R.drawable.ic_widget_repeat_all
                else -> R.drawable.ic_widget_repeat_off
            }
            views.setImageViewResource(R.id.widget_42_btn_repeat, repeatRes)

            views.setImageViewResource(
                R.id.widget_42_btn_like,
                if (MediaNotificationService.isLiked) R.drawable.ic_notification_liked
                else R.drawable.ic_widget_like_off
            )

            views.setOnClickPendingIntent(R.id.widget_42_art, getOpenAppIntent(context))
            views.setOnClickPendingIntent(R.id.widget_42_btn_play_pause, getPendingServiceIntent(context, MediaNotificationService.ACTION_PLAY_PAUSE, 201))
            views.setOnClickPendingIntent(R.id.widget_42_btn_next, getPendingServiceIntent(context, MediaNotificationService.ACTION_NEXT, 202))
            views.setOnClickPendingIntent(R.id.widget_42_btn_prev, getPendingServiceIntent(context, MediaNotificationService.ACTION_PREV, 203))
            views.setOnClickPendingIntent(R.id.widget_42_btn_shuffle, getPendingServiceIntent(context, MediaNotificationService.ACTION_SHUFFLE, 204))
            views.setOnClickPendingIntent(R.id.widget_42_btn_repeat, getPendingServiceIntent(context, MediaNotificationService.ACTION_REPEAT, 205))
            views.setOnClickPendingIntent(R.id.widget_42_btn_like, getPendingServiceIntent(context, MediaNotificationService.ACTION_LIKE, 206))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to populate 4x2 widget views", e)
        }

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
