package com.rivo.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

object MediaArtworkHelper {

    fun cleanArtworkBitmap(source: Bitmap): Bitmap {
        val width = source.width
        val height = source.height
        if (width <= 20 || height <= 20) return source

        fun isDarkPixel(color: Int): Boolean {
            val r = (color shr 16) and 0xFF
            val g = (color shr 8) and 0xFF
            val b = color and 0xFF
            return r < 24 && g < 24 && b < 24
        }

        fun isRowDark(y: Int): Boolean {
            val step = maxOf(1, width / 20)
            var darkCount = 0
            var total = 0
            for (x in 0 until width step step) {
                total++
                if (isDarkPixel(source.getPixel(x, y))) darkCount++
            }
            return darkCount.toFloat() / total >= 0.90f
        }

        fun isColDark(x: Int): Boolean {
            val step = maxOf(1, height / 20)
            var darkCount = 0
            var total = 0
            for (y in 0 until height step step) {
                total++
                if (isDarkPixel(source.getPixel(x, y))) darkCount++
            }
            return darkCount.toFloat() / total >= 0.90f
        }

        var top = 0
        while (top < height / 3 && isRowDark(top)) top++

        var bottom = height - 1
        while (bottom > height * 2 / 3 && isRowDark(bottom)) bottom--

        var left = 0
        while (left < width / 3 && isColDark(left)) left++

        var right = width - 1
        while (right > width * 2 / 3 && isColDark(right)) right--

        val cropW = right - left + 1
        val cropH = bottom - top + 1

        val cropped = if (cropW > 40 && cropH > 40 && (cropW < width || cropH < height)) {
            Bitmap.createBitmap(source, left, top, cropW, cropH)
        } else {
            source
        }

        val targetSize = 512
        val finalW = cropped.width
        val finalH = cropped.height

        return if (Math.abs(finalW - finalH) > 12) {
            val minDim = minOf(finalW, finalH)
            val xOff = (finalW - minDim) / 2
            val yOff = (finalH - minDim) / 2
            val centerSquare = Bitmap.createBitmap(cropped, xOff, yOff, minDim, minDim)
            Bitmap.createScaledBitmap(centerSquare, targetSize, targetSize, true)
        } else {
            Bitmap.createScaledBitmap(cropped, targetSize, targetSize, true)
        }
    }

    fun loadCoverBitmapAsync(urlStr: String?, onLoaded: (Bitmap) -> Unit) {
        if (urlStr.isNullOrBlank()) return

        thread {
            try {
                val rawBitmap: Bitmap? = when {
                    urlStr.startsWith("file://") -> {
                        val path = Uri.parse(urlStr).path ?: urlStr.replace("file://", "")
                        BitmapFactory.decodeFile(path)
                    }
                    urlStr.startsWith("http://") || urlStr.startsWith("https://") -> {
                        val connection = URL(urlStr).openConnection() as HttpURLConnection
                        connection.doInput = true
                        connection.connectTimeout = 3000
                        connection.readTimeout = 3000
                        connection.connect()
                        val input: InputStream = connection.inputStream
                        BitmapFactory.decodeStream(input)
                    }
                    else -> null
                }

                if (rawBitmap != null) {
                    val cleaned = cleanArtworkBitmap(rawBitmap)
                    onLoaded(cleaned)
                }
            } catch (_: Exception) {}
        }
    }
}
