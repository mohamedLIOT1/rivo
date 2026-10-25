package com.rivo.app

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ScreenLockReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_SCREEN_ON) return

        try {
            val prefs = context.getSharedPreferences("rivo_prefs", Context.MODE_PRIVATE)
            val isEnabled = prefs.getBoolean("lockscreen_overlay_enabled", true)
            if (!isEnabled) return

            // Only launch if music is playing
            if (!MediaNotificationService.isPlaying) return

            val km = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager ?: return
            if (km.isKeyguardLocked) {
                val lockIntent = Intent(context, LockScreenActivity::class.java).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                    )
                }
                context.startActivity(lockIntent)
            }
        } catch (_: Throwable) {
            // Safe guard against background launch restrictions
        }
    }
}
