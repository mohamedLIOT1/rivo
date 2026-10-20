use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use serde::{Deserialize, Serialize};
use base64::prelude::*;
use id3::{Tag, TagLike, Version};
use id3::frame::{Lyrics, Picture, PictureType, ExtendedText};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DesktopTrackItem {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub file_path: String,
    pub file_name: String,
    pub lrc_path: Option<String>,
    pub cover_path: Option<String>,
    pub is_verified_lyrics: bool,
    pub verified_by: Option<String>,
    pub has_lyrics: bool,
    pub saved_at: u64,
}

#[derive(Debug, Deserialize)]
pub struct DesktopDownloadPayload {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration: Option<f64>,
    pub audio_base64: String,
    pub cover_base64: Option<String>,
    pub lyrics_text: Option<String>,
    pub lyrics_lrc: Option<String>,
    pub is_verified_lyrics: bool,
    pub verified_by: Option<String>,
}

fn resolve_downloads_dir(app: &tauri::AppHandle) -> PathBuf {
    // 1. App installation directory / downloads (e.g. C:\Users\Ali\AppData\Local\Rivo\downloads)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let target = parent.join("downloads");
            if fs::create_dir_all(&target).is_ok() {
                return target;
            }
        }
    }
    // 2. Local app data fallback
    if let Ok(dir) = app.path().app_local_data_dir() {
        let target = dir.join("downloads");
        let _ = fs::create_dir_all(&target);
        return target;
    }
    let fallback = std::env::temp_dir().join("Rivo").join("downloads");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

fn sanitize_filename(name: &str, fallback: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | '?' | '%' | '*' | ':' | '|' | '"' | '<' | '>' => ' ',
            other => other,
        })
        .collect();
    let trimmed = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed
    }
}

fn clean_base64_data(input: &str) -> &str {
    if let Some(pos) = input.find(";base64,") {
        &input[pos + 8..]
    } else {
        input.trim()
    }
}

#[tauri::command]
fn get_desktop_downloads_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = resolve_downloads_dir(&app);
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn open_desktop_downloads_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = resolve_downloads_dir(&app);
    let dir_str = dir.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(&dir_str)
            .spawn();
    }
    Ok(dir_str)
}

#[tauri::command]
fn save_desktop_downloaded_track(
    app: tauri::AppHandle,
    payload: DesktopDownloadPayload,
) -> Result<DesktopTrackItem, String> {
    let downloads_dir = resolve_downloads_dir(&app);
    let clean_title = sanitize_filename(&payload.title, "Track");
    let clean_artist = sanitize_filename(&payload.artist, "Artist");
    let clean_album = sanitize_filename(payload.album.as_deref().unwrap_or("Single"), &clean_title);
    let duration = payload.duration.unwrap_or(0.0);

    let base_filename = format!("{} - {}", clean_artist, clean_title);
    let mp3_path = downloads_dir.join(format!("{}.mp3", base_filename));

    // 1. Decode & write MP3 audio
    let raw_audio_b64 = clean_base64_data(&payload.audio_base64);
    let audio_bytes = BASE64_STANDARD
        .decode(raw_audio_b64)
        .map_err(|e| format!("Failed to decode audio base64: {}", e))?;
    fs::write(&mp3_path, audio_bytes).map_err(|e| format!("Failed to write MP3 file: {}", e))?;

    // 2. Decode & save Cover image file alongside if provided
    let mut cover_path_str: Option<String> = None;
    let mut cover_raw_bytes: Option<Vec<u8>> = None;
    if let Some(ref cover_b64) = payload.cover_base64 {
        let raw_cover = clean_base64_data(cover_b64);
        if let Ok(cbytes) = BASE64_STANDARD.decode(raw_cover) {
            let cover_path = downloads_dir.join(format!("{}.jpg", base_filename));
            if fs::write(&cover_path, &cbytes).is_ok() {
                cover_path_str = Some(cover_path.to_string_lossy().to_string());
                cover_raw_bytes = Some(cbytes);
            }
        }
    }

    // 3. Write synchronized .lrc file alongside if provided
    let mut lrc_path_str: Option<String> = None;
    let has_lyrics = payload.lyrics_lrc.is_some() || payload.lyrics_text.is_some();
    if let Some(ref lrc_content) = payload.lyrics_lrc {
        if !lrc_content.trim().is_empty() {
            let lrc_path = downloads_dir.join(format!("{}.lrc", base_filename));
            if fs::write(&lrc_path, lrc_content).is_ok() {
                lrc_path_str = Some(lrc_path.to_string_lossy().to_string());
            }
        }
    }

    // 4. Embed ID3 tags into MP3 (Title, Artist, Album, Cover Art, and Embedded Lyrics)
    let mut tag = Tag::read_from_path(&mp3_path).unwrap_or_else(|_| Tag::new());
    tag.set_title(&clean_title);
    tag.set_artist(&clean_artist);
    tag.set_album(&clean_album);
    tag.set_genre("Music");

    // Embed Front Cover Picture
    if let Some(cbytes) = cover_raw_bytes {
        tag.add_frame(Picture {
            mime_type: "image/jpeg".to_string(),
            picture_type: PictureType::CoverFront,
            description: "Cover Art".to_string(),
            data: cbytes,
        });
    }

    // Embed lyrics inside the MP3 USLT frame
    let lyrics_to_embed = payload.lyrics_lrc.as_ref().or(payload.lyrics_text.as_ref());
    if let Some(lyrics_str) = lyrics_to_embed {
        if !lyrics_str.trim().is_empty() {
            let desc = if payload.is_verified_lyrics {
                "Verified by Rivo".to_string()
            } else {
                "".to_string()
            };
            tag.add_frame(Lyrics {
                lang: "eng".to_string(),
                description: desc,
                text: lyrics_str.clone(),
            });

            if payload.is_verified_lyrics {
                tag.add_frame(ExtendedText {
                    description: "RIVO_VERIFIED_LYRICS".to_string(),
                    value: "true".to_string(),
                });
                if let Some(ref verifier) = payload.verified_by {
                    tag.add_frame(ExtendedText {
                        description: "RIVO_VERIFIED_BY".to_string(),
                        value: verifier.clone(),
                    });
                }
            }
        }
    }

    let _ = tag.write_to_path(&mp3_path, Version::Id3v24);

    let now_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let item = DesktopTrackItem {
        id: payload.id,
        title: clean_title,
        artist: clean_artist,
        album: clean_album,
        duration,
        file_path: mp3_path.to_string_lossy().to_string(),
        file_name: format!("{}.mp3", base_filename),
        lrc_path: lrc_path_str,
        cover_path: cover_path_str,
        is_verified_lyrics: payload.is_verified_lyrics,
        verified_by: payload.verified_by,
        has_lyrics,
        saved_at: now_ts,
    };

    // 5. Update downloads manifest.json
    let manifest_path = downloads_dir.join("manifest.json");
    let mut items: Vec<DesktopTrackItem> = if manifest_path.exists() {
        fs::read_to_string(&manifest_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    // Replace existing if id matches, or append
    if let Some(pos) = items.iter().position(|it| it.id == item.id) {
        items[pos] = item.clone();
    } else {
        items.push(item.clone());
    }

    let _ = fs::write(&manifest_path, serde_json::to_string_pretty(&items).unwrap_or_default());

    Ok(item)
}

#[tauri::command]
fn list_desktop_downloaded_tracks(app: tauri::AppHandle) -> Result<Vec<DesktopTrackItem>, String> {
    let dir = resolve_downloads_dir(&app);
    let manifest_path = dir.join("manifest.json");
    if manifest_path.exists() {
        if let Ok(content) = fs::read_to_string(&manifest_path) {
            if let Ok(mut items) = serde_json::from_str::<Vec<DesktopTrackItem>>(&content) {
                items.retain(|item| Path::new(&item.file_path).exists());
                return Ok(items);
            }
        }
    }

    // Fallback: scan downloads folder for any .mp3 files
    let mut scanned = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("mp3") {
                let file_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("track").to_string();
                let (artist, title) = if let Some((a, t)) = file_name.split_once(" - ") {
                    (a.trim().to_string(), t.trim().to_string())
                } else {
                    ("Artist".to_string(), file_name.clone())
                };

                let lrc_path = dir.join(format!("{}.lrc", file_name));
                let lrc_str = if lrc_path.exists() { Some(lrc_path.to_string_lossy().to_string()) } else { None };

                let cover_path = dir.join(format!("{}.jpg", file_name));
                let cover_str = if cover_path.exists() { Some(cover_path.to_string_lossy().to_string()) } else { None };

                let mut is_verified = false;
                let mut has_lyrics = lrc_str.is_some();
                if let Ok(tag) = Tag::read_from_path(&path) {
                    if let Some(lyrics) = tag.lyrics().next() {
                        has_lyrics = true;
                        if lyrics.description.contains("Verified") {
                            is_verified = true;
                        }
                    }
                    for ext in tag.extended_texts() {
                        if ext.description == "RIVO_VERIFIED_LYRICS" && ext.value == "true" {
                            is_verified = true;
                        }
                    }
                }

                scanned.push(DesktopTrackItem {
                    id: format!("local-{}", file_name.replace(' ', "-").to_lowercase()),
                    title,
                    artist,
                    album: "Offline".to_string(),
                    duration: 0.0,
                    file_path: path.to_string_lossy().to_string(),
                    file_name: format!("{}.mp3", file_name),
                    lrc_path: lrc_str,
                    cover_path: cover_str,
                    is_verified_lyrics: is_verified,
                    verified_by: if is_verified { Some("Rivo".to_string()) } else { None },
                    has_lyrics,
                    saved_at: 0,
                });
            }
        }
    }

    Ok(scanned)
}

#[tauri::command]
fn delete_desktop_downloaded_track(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let dir = resolve_downloads_dir(&app);
    let manifest_path = dir.join("manifest.json");
    let mut found = false;
    if manifest_path.exists() {
        if let Ok(content) = fs::read_to_string(&manifest_path) {
            if let Ok(mut items) = serde_json::from_str::<Vec<DesktopTrackItem>>(&content) {
                if let Some(idx) = items.iter().position(|item| item.id == id) {
                    let item = items.remove(idx);
                    let _ = fs::remove_file(&item.file_path);
                    if let Some(lrc) = item.lrc_path {
                        let _ = fs::remove_file(lrc);
                    }
                    if let Some(cover) = item.cover_path {
                        let _ = fs::remove_file(cover);
                    }
                    found = true;
                    let _ = fs::write(&manifest_path, serde_json::to_string_pretty(&items).unwrap_or_default());
                }
            }
        }
    }
    Ok(found)
}

#[tauri::command]
fn read_desktop_lrc(lrc_path: String) -> Result<String, String> {
    fs::read_to_string(&lrc_path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
        get_desktop_downloads_dir,
        open_desktop_downloads_dir,
        save_desktop_downloaded_track,
        list_desktop_downloaded_tracks,
        delete_desktop_downloaded_track,
        read_desktop_lrc
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
