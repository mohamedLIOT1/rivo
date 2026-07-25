package com.liofy.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.util.Log;
import java.io.File;

public class LiofyMusicEngine {
    private static final String TAG = "LiofyMusicEngine";
    private final Context context;
    private final DownloadManager downloadManager;

    public LiofyMusicEngine(Context context) {
        this.context = context;
        this.downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
    }

    /**
     * Downloads a song and saves it as a real .mp3 file in the app's private storage.
     */
    public long downloadSong(String url, String songId) {
        try {
            File folder = new File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "LiofySongs");
            if (!folder.exists()) folder.mkdirs();

            File file = new File(folder, songId + ".mp3");
            if (file.exists()) return -1; // Already downloaded

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                    .setTitle("Liofy Download")
                    .setDescription("Downloading your song for offline play...")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                    .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_MUSIC, "LiofySongs/" + songId + ".mp3")
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(true);

            return downloadManager.enqueue(request);
        } catch (Exception e) {
            Log.e(TAG, "Download failed for " + songId, e);
            return -1;
        }
    }

    /**
     * Checks if a song is available locally and returns the File object.
     */
    public File getLocalSongFile(String songId) {
        File folder = new File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "LiofySongs");
        File file = new File(folder, songId + ".mp3");
        return file.exists() ? file : null;
    }

    /**
     * Extracts Song ID from various URL formats.
     */
    public String extractSongId(String url) {
        try {
            Uri uri = Uri.parse(url);
            String id = uri.getQueryParameter("v"); // YouTube
            if (id == null) id = uri.getQueryParameter("id"); // Proxy/API
            if (id == null) {
                // Try to get from path if no query params
                String lastSegment = uri.getLastPathSegment();
                if (lastSegment != null && lastSegment.length() >= 11) id = lastSegment;
            }
            return id;
        } catch (Exception e) {
            return null;
        }
    }
}
