package com.liofy.app.api

import com.liofy.app.models.Track
import retrofit2.http.GET

interface LiofyApiService {
    @GET("api/tracks")
    suspend fun getTracks(): TracksResponse
}

data class TracksResponse(
    val success: Boolean,
    val tracks: List<Track>
)
