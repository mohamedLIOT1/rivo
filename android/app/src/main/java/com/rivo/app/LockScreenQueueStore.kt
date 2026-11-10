package com.rivo.app

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

data class LockScreenQueueItem(
    val index: Int,
    val id: String,
    val title: String,
    val artist: String,
    val isCurrent: Boolean
)

object LockScreenQueueStore {
    @Volatile
    var items: List<LockScreenQueueItem> = emptyList()

    fun updateFromBridge(queueArray: ReadableArray?, currentTrackId: String?) {
        if (queueArray == null) {
            items = emptyList()
            return
        }
        try {
            val parsed = ArrayList<LockScreenQueueItem>(queueArray.size())
            for (i in 0 until queueArray.size()) {
                if (queueArray.getType(i) != ReadableType.Map) continue
                val map = queueArray.getMap(i) ?: continue
                val id = readString(map, "id", i.toString())
                val title = readString(map, "title", "Unknown Track").ifBlank { "Unknown Track" }
                val artist = readString(map, "artist", "Unknown Artist").ifBlank { "Unknown Artist" }
                val isCurrent = !currentTrackId.isNullOrEmpty() && id == currentTrackId
                parsed.add(
                    LockScreenQueueItem(
                        index = i,
                        id = id,
                        title = title,
                        artist = artist,
                        isCurrent = isCurrent
                    )
                )
            }
            items = parsed
        } catch (_: Throwable) {}
    }

    private fun readString(map: ReadableMap, key: String, fallback: String): String {
        if (!map.hasKey(key) || map.isNull(key)) return fallback
        return when (map.getType(key)) {
            ReadableType.String -> map.getString(key) ?: fallback
            ReadableType.Number -> map.getDouble(key).toLong().toString()
            else -> fallback
        }
    }
}
