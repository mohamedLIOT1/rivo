package com.liofy.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class Track(
    val id: String,
    val title: String,
    val artist: String,
    val cover: String,
    val audioUrl: String,
    val duration: Int = 0
)

class MusicViewModel : ViewModel() {
    private val _tracks = MutableStateFlow<List<Track>>(emptyList())
    val tracks: StateFlow<List<Track>> = _tracks

    private val _currentTrack = MutableStateFlow<Track?>(null)
    val currentTrack: StateFlow<Track?> = _currentTrack

    init {
        // Initial mock data
        _tracks.value = listOf(
            Track("1", "Lege-Cy - Placebo", "Lege-Cy", "https://i1.sndcdn.com/artworks-000674681653-m9v3v9-t500x500.jpg", "https://liofy-production.up.railway.app/audio/placebo.mp3"),
            Track("2", "Wegz - ElWa3d", "Wegz", "https://i1.sndcdn.com/artworks-000674681653-m9v3v9-t500x500.jpg", "https://liofy-production.up.railway.app/audio/elwa3d.mp3")
        )
    }

    fun playTrack(track: Track) {
        _currentTrack.value = track
    }
}
