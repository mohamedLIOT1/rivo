import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { RefreshCw, WifiOff, AlertTriangle } from 'lucide-react-native';
import { useToast } from '../context/ToastContext';
import { useAudioPlayer } from '../context/AudioContext';
import { downloadTrack as nativeDownloadTrack } from '../services/downloadManager';
import { colors } from '../theme/colors';
import { API_BASE_URL } from '../config';

const RIVO_WEB_URL = API_BASE_URL;

/**
 * JavaScript injected into the WebView before and after page load.
 *
 * 1. Creates global window.RIVO_NATIVE and bridge functions.
 * 2. Injects CSS rules so YouTube audio iframe players (#rivo-yt-player-1, #rivo-yt-player-2)
 *    are positioned on-screen (top: 0, left: 0) instead of off-screen (bottom: -500px),
 *    preventing Android WebView Chromium compositor from throttling/pausing audio playback.
 */
const INJECTED_JS = `
(function() {
  // ── Flag: running inside native APK ──
  window.RIVO_NATIVE = true;

  // ── Un-throttle YouTube iframe players in Android WebView ──
  var styleId = '__rivo_yt_unthrottle_css';
  if (!document.getElementById(styleId)) {
    var style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = '#rivo-yt-player-1, #rivo-yt-player-2 { position: fixed !important; top: 0 !important; left: 0 !important; bottom: auto !important; right: auto !important; width: 200px !important; height: 200px !important; opacity: 0.01 !important; z-index: -1 !important; overflow: hidden !important; pointer-events: none !important; }';
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        if (!document.getElementById(styleId) && document.head) {
          document.head.appendChild(style);
        }
      });
    }
  }

  // Periodic safeguard against dynamic inline styling overrides
  if (!window.__rivo_yt_interval_set) {
    window.__rivo_yt_interval_set = true;
    setInterval(function() {
      ['rivo-yt-player-1', 'rivo-yt-player-2'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
          if (el.style.bottom === '-500px' || el.style.bottom === '-500px !important' || el.style.width === '1px') {
            el.style.bottom = 'auto';
            el.style.right = 'auto';
            el.style.top = '0px';
            el.style.left = '0px';
            el.style.width = '200px';
            el.style.height = '200px';
            el.style.opacity = '0.01';
            el.style.zIndex = '-1';
            el.style.overflow = 'hidden';
            el.style.pointerEvents = 'none';
          }
        }
      });
    }, 300);
  }

  // Prevent double-injection of bridge functions
  if (window.__RIVO_NATIVE_INJECTED) return;
  window.__RIVO_NATIVE_INJECTED = true;

  // ── Bridge: send download request to native layer ──
  window.RIVO_DOWNLOAD = function(track) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DOWNLOAD_TRACK',
        track: track,
      }));
    }
  };

  // ── Bridge: send toast/status messages to native ──
  window.RIVO_TOAST = function(message, type) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'TOAST',
        message: message,
        toastType: type || 'info',
      }));
    }
  };

  true; // Required by react-native-webview
})();
`;

export default function OnlineWebView() {
  const webViewRef = useRef(null);
  const { showToast } = useToast();
  const { refreshDownloadedTracks } = useAudioPlayer();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);

  // ─── Handle messages from WebView (postMessage bridge) ──────
  const handleMessage = useCallback(async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'DOWNLOAD_TRACK': {
          const track = data.track;
          if (!track || (!track.id && !track._id)) {
            showToast('Invalid track data', 'error');
            return;
          }

          const trackName = track.title || 'Unknown';
          showToast(`Downloading "${trackName}" to device...`, 'info');
          setDownloadProgress({ title: trackName, percent: 0 });

          try {
            await nativeDownloadTrack(track, (percent) => {
              setDownloadProgress((prev) => prev ? { ...prev, percent } : null);
            });
            setDownloadProgress(null);
            showToast(`"${trackName}" saved to offline vault`, 'success');
            if (refreshDownloadedTracks) {
              await refreshDownloadedTracks();
            }
          } catch (err) {
            setDownloadProgress(null);
            showToast(`Download failed: ${err.message}`, 'error');
          }
          break;
        }

        case 'TOAST': {
          showToast(data.message || '', data.toastType || 'info');
          break;
        }

        default:
          break;
      }
    } catch (e) {
      // Non-JSON messages are ignored
    }
  }, [showToast]);

  // ─── Error / offline fallback UI ────────────────────────────
  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0b1110" />
        <View style={styles.errorCard}>
          <View style={styles.errorIconCircle}>
            <WifiOff size={32} color={colors.teal} />
          </View>
          <Text style={styles.errorTitle}>CONNECTION LOST</Text>
          <Text style={styles.errorSub}>
            Unable to reach the Rivo server. Check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setHasError(false);
              setLoading(true);
              webViewRef.current?.reload();
            }}
            activeOpacity={0.8}
          >
            <RefreshCw size={14} color="#0b1110" />
            <Text style={styles.retryText}>RETRY CONNECTION</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: RIVO_WEB_URL }}
        style={styles.webview}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
        injectedJavaScript={INJECTED_JS}
        onMessage={handleMessage}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setHasError(true);
        }}
        onHttpError={(syntheticEvent) => {
          const { statusCode } = syntheticEvent.nativeEvent;
          if (statusCode >= 500) {
            setHasError(true);
          }
        }}
        // WebView settings optimized for YouTube embed & audio playback
        javaScriptEnabled={true}
        domStorageEnabled={true}
        databaseEnabled={true}
        mediaPlaybackRequiresUserGesture={false}
        allowsInlineMediaPlayback={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
        androidHardwareAccelerationDisabledBinding={false}
        originWhitelist={['*']}
        allowsFullscreenVideo={true}
        setSupportMultipleWindows={false}
        startInLoadingState={false}
        cacheEnabled={true}
      />

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.teal} />
            <Text style={styles.loadingText}>CONNECTING TO RIVO...</Text>
          </View>
        </View>
      )}

      {/* Download progress indicator */}
      {downloadProgress && (
        <View style={styles.downloadBanner}>
          <View style={styles.downloadInner}>
            <Text style={styles.downloadTitle} numberOfLines={1}>
              ⬇ {downloadProgress.title}
            </Text>
            <View style={styles.downloadBar}>
              <View
                style={[
                  styles.downloadFill,
                  { width: `${downloadProgress.percent}%` },
                ]}
              />
            </View>
            <Text style={styles.downloadPercent}>
              {downloadProgress.percent}%
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0b1110',
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b1110',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.teal,
    letterSpacing: 1,
  },

  // Error screen
  errorContainer: {
    flex: 1,
    backgroundColor: '#0b1110',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorCard: {
    backgroundColor: '#141d1b',
    borderWidth: 2.5,
    borderColor: '#0b1110',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(23,163,152,0.15)',
    borderWidth: 2,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: '#fdfbf7',
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.teal,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0b1110',
  },
  retryText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: '#0b1110',
  },

  // Download progress banner
  downloadBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#141d1b',
    borderTopWidth: 2,
    borderTopColor: colors.teal,
    padding: 10,
  },
  downloadInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  downloadTitle: {
    flex: 1,
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 10,
    color: '#fdfbf7',
  },
  downloadBar: {
    width: 80,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  downloadFill: {
    height: '100%',
    backgroundColor: colors.teal,
  },
  downloadPercent: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.teal,
    width: 32,
    textAlign: 'right',
  },
});
