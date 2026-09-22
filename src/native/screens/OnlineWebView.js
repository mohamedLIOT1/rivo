import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StatusBar,
  BackHandler,
  Platform,
  AppState,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { RefreshCw, WifiOff, AlertTriangle } from 'lucide-react-native';
import { useToast } from '../context/ToastContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { downloadTrack as nativeDownloadTrack } from '../services/downloadManager';
import {
  showMediaNotification,
  updateMediaNotification,
  hideMediaNotification,
  subscribeToMediaActions,
} from '../services/mediaControls';
import { colors } from '../theme/colors';
import { API_BASE_URL } from '../config';

const RIVO_WEB_URL = API_BASE_URL;

/**
 * JavaScript injected into the WebView before and after page load.
 *
 * 1. Creates global window.RIVO_NATIVE and bridge functions.
 */
const INJECTED_JS = `
(function() {
  window.RIVO_NATIVE = true;
  try {
    if (document.documentElement) {
      document.documentElement.classList.add('rivo-native-app');
    }
  } catch(e) {}

  // 1. Spoof Page Visibility API so WebView never detects when app is backgrounded or screen is locked
  try {
    Object.defineProperty(document, 'hidden', {
      get: function() { return false; },
      configurable: true
    });
    Object.defineProperty(document, 'visibilityState', {
      get: function() { return 'visible'; },
      configurable: true
    });
    Object.defineProperty(document, 'webkitHidden', {
      get: function() { return false; },
      configurable: true
    });
    Object.defineProperty(document, 'webkitVisibilityState', {
      get: function() { return 'visible'; },
      configurable: true
    });
    document.hasFocus = function() { return true; };
  } catch(e) {}

  // 2. Block visibilitychange, blur, and pagehide events from pausing media players
  var stopEvent = function(e) {
    if (e) {
      e.stopImmediatePropagation();
      e.stopPropagation();
    }
  };
  window.addEventListener('visibilitychange', stopEvent, true);
  document.addEventListener('visibilitychange', stopEvent, true);
  window.addEventListener('webkitvisibilitychange', stopEvent, true);
  document.addEventListener('webkitvisibilitychange', stopEvent, true);
  window.addEventListener('blur', stopEvent, true);
  window.addEventListener('pagehide', stopEvent, true);

  // Prevent double-initialization
  if (window.__RIVO_NATIVE_INJECTED) return true;
  window.__RIVO_NATIVE_INJECTED = true;

  // 3. Intercept navigator.mediaSession handlers and disable 10s skip commands
  window.__RIVO_MEDIA_HANDLERS = window.__RIVO_MEDIA_HANDLERS || {};
  if (navigator && navigator.mediaSession) {
    var origSetActionHandler = navigator.mediaSession.setActionHandler ? navigator.mediaSession.setActionHandler.bind(navigator.mediaSession) : null;
    navigator.mediaSession.setActionHandler = function(action, handler) {
      if (action === 'seekforward' || action === 'seekbackward' || action === 'skipforward' || action === 'skipbackward') {
        return; // Suppress 10s skip commands so iOS lock screen always displays Next / Prev track buttons
      }
      window.__RIVO_MEDIA_HANDLERS[action] = handler;
      if (origSetActionHandler) {
        try { origSetActionHandler(action, handler); } catch(e) {}
      }
    };
    try {
      if (origSetActionHandler) {
        origSetActionHandler('seekforward', null);
        origSetActionHandler('seekbackward', null);
        origSetActionHandler('skipforward', null);
        origSetActionHandler('skipbackward', null);
      }
    } catch(e) {}
  }

  // 4. Global Action Handler for Android & iOS Notification & Lockscreen Controls
  window.__RIVO_MEDIA_ACTION = function(action) {
    try {
      var handlers = window.__RIVO_MEDIA_HANDLERS || {};

      if (action === 'play') {
        window.__RIVO_IS_PLAYING = true;
        window.__RIVO_USER_PAUSED = false;

        if (typeof handlers['play'] === 'function') {
          try { handlers['play'](); } catch(e) {}
        }
        var iframes = document.querySelectorAll('iframe[src*="youtube"]');
        iframes.forEach(function(f) {
          try { f.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*'); } catch(e) {}
        });
        document.querySelectorAll('audio, video').forEach(function(a) {
          try { a.play(); } catch(e) {}
        });
        var b = document.querySelector('button[title="Play"], button[title="Pause"]');
        if (b) b.click();

        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PLAYBACK_STATE',
            isPlaying: true
          }));
        }
      } else if (action === 'pause') {
        window.__RIVO_IS_PLAYING = false;
        window.__RIVO_USER_PAUSED = true;

        if (typeof handlers['pause'] === 'function') {
          try { handlers['pause'](); } catch(e) {}
        }
        var iframes = document.querySelectorAll('iframe[src*="youtube"]');
        iframes.forEach(function(f) {
          try { f.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*'); } catch(e) {}
        });
        document.querySelectorAll('audio, video').forEach(function(a) {
          try { a.pause(); } catch(e) {}
        });
        var b = document.querySelector('button[title="Pause"], button[title="Play"]');
        if (b) b.click();

        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PLAYBACK_STATE',
            isPlaying: false
          }));
        }
      } else if (action === 'play_pause') {
        if (window.__RIVO_IS_PLAYING) {
          window.__RIVO_MEDIA_ACTION('pause');
        } else {
          window.__RIVO_MEDIA_ACTION('play');
        }
      } else if (action === 'next') {
        if (typeof handlers['nexttrack'] === 'function') {
          try { handlers['nexttrack'](); return; } catch(e) {}
        }
        var b = document.querySelector('button[title="Next Track"], button[title="Next"]');
        if (b) b.click();
      } else if (action === 'prev') {
        if (typeof handlers['previoustrack'] === 'function') {
          try { handlers['previoustrack'](); return; } catch(e) {}
        }
        var b = document.querySelector('button[title="Previous Track"], button[title="Previous"]');
        if (b) b.click();
      } else if (action === 'repeat') {
        var b = document.querySelector('button[title*="Repeat"], button[aria-label*="Repeat"]');
        if (b) b.click();
      } else if (action === 'shuffle') {
        var b = document.querySelector('button[title*="Shuffle"], button[aria-label*="Shuffle"]');
        if (b) b.click();
      } else if (action === 'like') {
        var b = document.querySelector('button[title*="Like"], button[aria-label*="Like"]');
        if (b) b.click();
      } else if (typeof action === 'string' && action.indexOf('seek:') === 0) {
        var secs = parseFloat(action.split(':')[1]);
        if (!isNaN(secs)) {
          if (typeof window.__RIVO_MEDIA_SEEK === 'function') {
            window.__RIVO_MEDIA_SEEK(secs);
          }
        }
      }
    } catch(err) {
      console.warn('[Rivo Bridge] Error in media action:', err);
    }
  };

  // 5. Background watchdog: if playing and not paused by user, auto-resume any paused media
  setInterval(function() {
    try {
      if (window.__RIVO_IS_PLAYING && !window.__RIVO_USER_PAUSED) {
        document.querySelectorAll('audio, video').forEach(function(el) {
          if (el.paused) {
            el.play().catch(function() {});
          }
        });
      }
    } catch(e) {}
  }, 800);

  // 7. Bridge: send download request to native layer
  window.RIVO_DOWNLOAD = function(track) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DOWNLOAD_TRACK',
        track: track,
      }));
    }
  };

  // Bridge: send toast/status messages to native
  window.RIVO_TOAST = function(message, type) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'TOAST',
        message: message,
        toastType: type || 'info',
      }));
    }
  };

  true;
})();
`;

export default function OnlineWebView() {
  const webViewRef = useRef(null);
  const { showToast } = useToast();
  const { refreshDownloadedTracks } = useAudioPlayer();
  const { appMode } = useConnectivity();
  const isOnline = appMode === 'online';
  const prevOnlineRef = useRef(isOnline);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const [hasError, setHasError] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const currentTrackRef = useRef(null);

  // ─── AppState Background Audio Keeper (Resumes playback when moving to background) ───
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(`
            (function() {
              try {
                if (window.__RIVO_IS_PLAYING && !window.__RIVO_USER_PAUSED) {
                  var iframes = document.querySelectorAll('iframe[src*="youtube"]');
                  iframes.forEach(function(f) {
                    try { f.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*'); } catch(e) {}
                  });
                  document.querySelectorAll('audio, video').forEach(function(el) {
                    if (el.paused) el.play().catch(function() {});
                  });
                }
              } catch(e) {}
            })();
            true;
          `);
        }, 250);
      }
    });
    return () => sub.remove();
  }, []);

  // ─── Hardware Back Button Handler (navigate back inside WebView instead of exiting) ───
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // handled, don't exit app
      }
      return false;
    };
    const backHandlerSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandlerSub.remove();
  }, [canGoBack]);

  // ─── Automatic network transition handler ───
  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) {
      setHasError(false);
      hasLoadedOnceRef.current = false;
      setInitialLoading(true);
      webViewRef.current?.reload();
    } else if (!isOnline) {
      webViewRef.current?.injectJavaScript(`
        if (typeof window.__RIVO_MEDIA_ACTION === 'function') {
          window.__RIVO_MEDIA_ACTION('pause');
        }
        true;
      `);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  // ─── Subscribe to Native Android Media Controls (Notification & Lockscreen) ───
  useEffect(() => {
    const unsubscribe = subscribeToMediaActions((action) => {
      webViewRef.current?.injectJavaScript(`
        (function() {
          try {
            if (typeof window.__RIVO_MEDIA_ACTION === 'function') {
              window.__RIVO_MEDIA_ACTION('${action}');
            } else if (window.__RIVO_MEDIA_HANDLERS) {
              if ('${action}' === 'play' && typeof window.__RIVO_MEDIA_HANDLERS['play'] === 'function') {
                window.__RIVO_MEDIA_HANDLERS['play']();
              } else if ('${action}' === 'pause' && typeof window.__RIVO_MEDIA_HANDLERS['pause'] === 'function') {
                window.__RIVO_MEDIA_HANDLERS['pause']();
              } else if ('${action}' === 'next' && typeof window.__RIVO_MEDIA_HANDLERS['nexttrack'] === 'function') {
                window.__RIVO_MEDIA_HANDLERS['nexttrack']();
              } else if ('${action}' === 'prev' && typeof window.__RIVO_MEDIA_HANDLERS['previoustrack'] === 'function') {
                window.__RIVO_MEDIA_HANDLERS['previoustrack']();
              }
            }
          } catch(e) {}
        })();
        true;
      `);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // ─── Handle messages from WebView (postMessage bridge) ────────────
  const handleMessage = useCallback(async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'PLAYBACK_STATE': {
          const { track, isPlaying } = data;
          if (track) {
            const isSameTrack = currentTrackRef.current &&
              ((track.id && track.id === currentTrackRef.current.id) ||
               (track.title && track.title === currentTrackRef.current.title));
            const existingCover = isSameTrack ? (currentTrackRef.current?.coverUrl || currentTrackRef.current?.cover || '') : '';
            const incomingCover = track.coverUrl || track.cover || '';
            currentTrackRef.current = {
              ...(isSameTrack ? currentTrackRef.current : {}),
              ...track,
              coverUrl: incomingCover || existingCover || '',
            };
          }
          const activeTrack = currentTrackRef.current;
          const trackDur = Number(data.duration !== undefined ? data.duration : (activeTrack?.duration || 240));
          const trackTime = Number(data.currentTime !== undefined ? data.currentTime : (activeTrack?.currentTime || 0));
          const isRepeatState = Boolean(data.isRepeat);
          const isShuffleState = Boolean(data.isShuffle);
          const isLikedState = Boolean(data.isLiked !== undefined ? data.isLiked : (activeTrack?.liked || activeTrack?.isLiked));

          if (activeTrack) {
            showMediaNotification({
              ...activeTrack,
              duration: trackDur,
              currentTime: trackTime,
              liked: isLikedState,
            }, Boolean(isPlaying), isRepeatState, isShuffleState, isLikedState);
          } else {
            updateMediaNotification(
              Boolean(isPlaying),
              isRepeatState,
              isShuffleState,
              isLikedState,
              activeTrack ? {
                ...activeTrack,
                duration: trackDur,
                currentTime: trackTime,
                liked: isLikedState,
              } : null
            );
          }
          break;
        }

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
  }, [showToast, refreshDownloadedTracks]);

  // â”€â”€â”€ Error / offline fallback UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
              hasLoadedOnceRef.current = false;
              setInitialLoading(true);
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
        onNavigationStateChange={(navState) => {
          setCanGoBack(Boolean(navState.canGoBack));
        }}
        onLoadStart={() => {
          if (!hasLoadedOnceRef.current) {
            setInitialLoading(true);
          }
        }}
        onLoadEnd={() => {
          hasLoadedOnceRef.current = true;
          setInitialLoading(false);
        }}
        onError={() => {
          setInitialLoading(false);
          setHasError(true);
        }}
        onHttpError={(syntheticEvent) => {
          const { statusCode } = syntheticEvent.nativeEvent;
          if (statusCode >= 500 && !hasLoadedOnceRef.current) {
            setHasError(true);
          }
        }}
        // WebView settings optimized for YouTube embed & audio playback
        javaScriptEnabled={true}
        domStorageEnabled={true}
        databaseEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        mediaPlaybackRequiresUserGesture={false}
        allowsProtectedMedia={true}
        allowsInlineMediaPlayback={true}
        allowsPictureInPictureMediaPlayback={true}
        useWebKit={true}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url && request.url.includes('/api/tracks/download')) {
            try {
              const urlObj = new URL(request.url);
              const trackId = urlObj.searchParams.get('id');
              const title = urlObj.searchParams.get('title') || 'Track';
              const artist = urlObj.searchParams.get('artist') || 'Unknown';
              const audioUrl = urlObj.searchParams.get('url') || '';
              handleMessage({
                nativeEvent: {
                  data: JSON.stringify({
                    type: 'DOWNLOAD_TRACK',
                    track: {
                      id: trackId || `dl-${Date.now()}`,
                      _id: trackId || `dl-${Date.now()}`,
                      title,
                      artist,
                      audioUrl,
                    }
                  })
                }
              });
            } catch (e) {}
            return false;
          }
          return true;
        }}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        userAgent={
          Platform.OS === 'ios'
            ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
            : "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
        }
        injectedJavaScriptForMainFrameOnly={false}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
        androidHardwareAccelerationDisabled={false}
        androidLayerType="hardware"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        originWhitelist={['*']}
        allowsFullscreenVideo={true}
        setSupportMultipleWindows={false}
        startInLoadingState={false}
        cacheEnabled={true}
      />

      {/* Loading overlay - only on initial cold boot or manual retry */}
      {initialLoading && (
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
              â¬‡ {downloadProgress.title}
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
