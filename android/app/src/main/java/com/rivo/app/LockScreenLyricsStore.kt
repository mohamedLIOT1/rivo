package com.rivo.app

import com.facebook.react.bridge.Dynamic
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableType
import java.util.regex.Pattern

data class LyricEntry(
    val timeMs: Long,
    val text: String
)

object LockScreenLyricsStore {
    @Volatile
    var currentLyrics: List<LyricEntry> = emptyList()

    fun clear() {
        currentLyrics = emptyList()
    }

    fun updateFromBridge(input: Dynamic?) {
        if (input == null || input.isNull) {
            currentLyrics = emptyList()
            return
        }
        try {
            when (input.type) {
                ReadableType.Array -> parseArray(input.asArray())
                ReadableType.String -> parseString(input.asString() ?: "")
                else -> currentLyrics = emptyList()
            }
        } catch (_: Throwable) {
            currentLyrics = emptyList()
        }
    }

    fun parseArray(array: ReadableArray?) {
        if (array == null || array.size() == 0) {
            currentLyrics = emptyList()
            return
        }
        val list = ArrayList<LyricEntry>(array.size())
        for (i in 0 until array.size()) {
            if (array.getType(i) != ReadableType.Map) continue
            val map = array.getMap(i) ?: continue
            val text = when {
                map.hasKey("text") && !map.isNull("text") -> map.getString("text")?.trim() ?: ""
                map.hasKey("line") && !map.isNull("line") -> map.getString("line")?.trim() ?: ""
                else -> ""
            }
            if (text.isEmpty()) continue

            var timeMs: Long = -1L
            if (map.hasKey("time") && !map.isNull("time")) {
                val t = map.getDouble("time")
                timeMs = if (t in 0.0..10000.0) (t * 1000.0).toLong() else t.toLong()
            } else if (map.hasKey("timeMs") && !map.isNull("timeMs")) {
                timeMs = map.getDouble("timeMs").toLong()
            }

            if (timeMs >= 0) {
                list.add(LyricEntry(timeMs, text))
            }
        }
        list.sortBy { it.timeMs }
        currentLyrics = list
    }

    fun parseString(raw: String) {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) {
            currentLyrics = emptyList()
            return
        }
        val lrcRegex = Pattern.compile("\\[(\\d{1,2}):(\\d{2})(?:[.:](\\d{1,3}))?\\]")
        val lines = trimmed.split("\n")
        val list = ArrayList<LyricEntry>()
        for (line in lines) {
            val matcher = lrcRegex.matcher(line)
            if (matcher.find()) {
                val m = matcher.group(1)?.toLongOrNull() ?: 0L
                val s = matcher.group(2)?.toLongOrNull() ?: 0L
                val fracStr = matcher.group(3) ?: "0"
                val fracMs = when (fracStr.length) {
                    1 -> (fracStr.toLongOrNull() ?: 0L) * 100L
                    2 -> (fracStr.toLongOrNull() ?: 0L) * 10L
                    else -> fracStr.take(3).toLongOrNull() ?: 0L
                }
                val timeMs = (m * 60L + s) * 1000L + fracMs
                val text = matcher.replaceAll("").trim()
                if (text.isNotEmpty()) {
                    list.add(LyricEntry(timeMs, text))
                }
            }
        }
        list.sortBy { it.timeMs }
        currentLyrics = list
    }

    fun getActiveLyric(posMs: Long): String? {
        val list = currentLyrics
        if (list.isEmpty()) return null

        val first = list.first()
        if (posMs < first.timeMs) return null

        var active: LyricEntry? = null
        var nextTimeMs = Long.MAX_VALUE

        for (i in list.indices) {
            val entry = list[i]
            if (entry.timeMs <= posMs) {
                active = entry
                nextTimeMs = if (i + 1 < list.size) list[i + 1].timeMs else Long.MAX_VALUE
            } else {
                break
            }
        }

        if (active != null) {
            if (posMs - active.timeMs > 12_000L && nextTimeMs - active.timeMs > 14_000L) {
                return null
            }
            return active.text
        }
        return null
    }
}
