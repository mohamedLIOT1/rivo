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

    fun hasSyncedLyrics(): Boolean {
        return currentLyrics.any { it.timeMs >= 0L }
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

            list.add(LyricEntry(timeMs, text))
        }
        if (list.any { it.timeMs >= 0L }) {
            list.sortBy { it.timeMs }
        }
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
        if (list.isNotEmpty()) {
            list.sortBy { it.timeMs }
            currentLyrics = list
        } else {
            currentLyrics = lines
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .map { LyricEntry(-1L, it) }
        }
    }

    fun getActiveLyric(posMs: Long): String? {
        val list = currentLyrics
        if (list.isEmpty()) return null

        val firstSynced = list.firstOrNull { it.timeMs >= 0L } ?: return null
        if (posMs < firstSynced.timeMs) return null

        var active: LyricEntry? = null
        var nextTimeMs = Long.MAX_VALUE

        for (i in list.indices) {
            val entry = list[i]
            if (entry.timeMs in 0..posMs) {
                active = entry
                nextTimeMs = if (i + 1 < list.size) list[i + 1].timeMs else Long.MAX_VALUE
            } else if (entry.timeMs > posMs) {
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

    fun getActiveLyricIndex(posMs: Long): Int {
        val list = currentLyrics
        if (list.isEmpty()) return -1

        var activeIndex = -1
        for (i in list.indices) {
            val entry = list[i]
            if (entry.timeMs in 0..posMs) {
                activeIndex = i
            } else if (entry.timeMs > posMs) {
                break
            }
        }
        return activeIndex
    }
}
