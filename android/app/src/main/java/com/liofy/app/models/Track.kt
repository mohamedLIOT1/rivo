package com.liofy.app.models

data class Track(
    val id: String,
    val title: String,
    val artist: String,
    val cover: String,
    val audioUrl: String,
    val duration: Int = 0
)
