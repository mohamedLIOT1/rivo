package com.liofy.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "LiofyEngine")
public class LiofyMusicPlugin extends Plugin {

    @PluginMethod
    public void downloadSong(PluginCall call) {
        String url = call.getString("url");
        String songId = call.getString("id");

        if (url == null || songId == null) {
            call.reject("URL and ID are required");
            return;
        }

        try {
            Context context = getContext();
            DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);

            File folder = new File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "LiofySongs");
            if (!folder.exists()) folder.mkdirs();

            File file = new File(folder, songId + ".mp3");
            if (file.exists()) {
                JSObject ret = new JSObject();
                ret.put("path", getBridge().getWebView().getContext().getExternalFilesDir(Environment.DIRECTORY_MUSIC).getAbsolutePath() + "/LiofySongs/" + songId + ".mp3");
                ret.put("status", "already_downloaded");
                call.resolve(ret);
                return;
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                    .setTitle("Liofy: Downloading Song")
                    .setDescription("Preparing your music for offline playback...")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_MUSIC, "LiofySongs/" + songId + ".mp3")
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(true);

            downloadManager.enqueue(request);

            JSObject ret = new JSObject();
            ret.put("status", "downloading");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Download failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkOfflineStatus(PluginCall call) {
        String songId = call.getString("id");
        if (songId == null) {
            call.reject("ID is required");
            return;
        }

        Context context = getContext();
        File folder = new File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "LiofySongs");
        File file = new File(folder, songId + ".mp3");

        JSObject ret = new JSObject();
        if (file.exists()) {
            ret.put("downloaded", true);
            ret.put("path", getBridge().convertFileSrc(Uri.fromFile(file).toString()));
        } else {
            ret.put("downloaded", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void deleteSong(PluginCall call) {
        String songId = call.getString("id");
        if (songId == null) {
            call.reject("ID is required");
            return;
        }

        Context context = getContext();
        File file = new File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "LiofySongs/" + songId + ".mp3");
        if (file.exists()) {
            boolean deleted = file.delete();
            JSObject ret = new JSObject();
            ret.put("success", deleted);
            call.resolve(ret);
        } else {
            call.resolve();
        }
    }
}
