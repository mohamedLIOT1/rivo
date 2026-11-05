package com.rivo.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import java.io.File

object RivoOtaHelper {

    fun installApk(reactContext: ReactApplicationContext, filePath: String, promise: Promise) {
        try {
            val context = reactContext.currentActivity ?: reactContext.applicationContext
            val cleanPath = filePath.replace("file://", "")
            val file = File(cleanPath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "APK file does not exist at $cleanPath")
                return
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.packageManager.canRequestPackageInstalls()) {
                    val settingsIntent = Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(settingsIntent)
                    promise.reject("PERMISSION_REQUIRED", "Please allow Rivo to install unknown apps from settings, then click update again.")
                    return
                }
            }

            val uri: Uri = FileProvider.getUriForFile(
                context,
                "com.rivo.app.fileprovider",
                file
            )

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("INSTALL_ERROR", e.message, e)
        }
    }

    fun applyOtaBundle(reactContext: ReactApplicationContext, tempFilePath: String, promise: Promise) {
        try {
            val context = reactContext.applicationContext
            val cleanPath = tempFilePath.replace("file://", "")
            val srcFile = File(cleanPath)
            if (!srcFile.exists() || srcFile.length() < 1024) {
                promise.reject("INVALID_BUNDLE", "Downloaded bundle is missing or invalid")
                return
            }

            val otaDir = File(context.filesDir, "rivo_ota")
            if (!otaDir.exists()) {
                otaDir.mkdirs()
            }

            val targetFile = File(otaDir, "index.android.bundle")
            val targetBackup = File(otaDir, "index.android.bundle.bak")

            if (targetFile.exists()) {
                targetFile.copyTo(targetBackup, overwrite = true)
            }

            srcFile.copyTo(targetFile, overwrite = true)
            try { srcFile.delete() } catch (_: Exception) {}

            promise.resolve(targetFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("APPLY_ERROR", e.message, e)
        }
    }

    fun reloadApp(reactContext: ReactApplicationContext, promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            val context = reactContext.applicationContext
            val packageManager = context.packageManager
            val intent = packageManager.getLaunchIntentForPackage(context.packageName)
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                val pendingIntent = PendingIntent.getActivity(
                    context,
                    123456,
                    intent,
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    } else {
                        PendingIntent.FLAG_CANCEL_CURRENT
                    }
                )
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                alarmManager?.set(
                    AlarmManager.RTC,
                    System.currentTimeMillis() + 250,
                    pendingIntent
                )

                activity?.finishAffinity()
                activity?.finishAndRemoveTask()
                Process.killProcess(Process.myPid())
                System.exit(0)
                promise.resolve(true)
            } else {
                promise.reject("RELOAD_ERROR", "Launch intent unavailable")
            }
        } catch (e: Exception) {
            try {
                reactContext.currentActivity?.finishAndRemoveTask()
                Process.killProcess(Process.myPid())
                System.exit(0)
            } catch (_: Exception) {}
            promise.resolve(true)
        }
    }

    fun exitAndRemoveTask(reactContext: ReactApplicationContext, promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            activity?.finishAndRemoveTask()
            Process.killProcess(Process.myPid())
            System.exit(0)
            promise.resolve(true)
        } catch (e: Exception) {
            try {
                System.exit(0)
            } catch (_: Exception) {}
            promise.resolve(true)
        }
    }

    fun clearOtaBundle(reactContext: ReactApplicationContext, promise: Promise) {
        try {
            val otaDir = File(reactContext.applicationContext.filesDir, "rivo_ota")
            if (otaDir.exists()) {
                otaDir.deleteRecursively()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", e.message, e)
        }
    }

    fun getOtaInfo(reactContext: ReactApplicationContext, promise: Promise) {
        try {
            val otaFile = File(reactContext.applicationContext.filesDir, "rivo_ota/index.android.bundle")
            val map: WritableMap = Arguments.createMap()
            if (otaFile.exists() && otaFile.isFile) {
                map.putBoolean("exists", true)
                map.putDouble("size", otaFile.length().toDouble())
                map.putDouble("lastModified", otaFile.lastModified().toDouble())
            } else {
                map.putBoolean("exists", false)
                map.putDouble("size", 0.0)
                map.putDouble("lastModified", 0.0)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("INFO_ERROR", e.message, e)
        }
    }
}
