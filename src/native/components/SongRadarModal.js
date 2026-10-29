import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import {
  X,
  Mic,
  Radio,
  Play,
  Heart,
  PlusCircle,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Music,
} from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import { API_BASE_URL } from '../config';
import { normalizeCoverUri } from '../utils/coverUtils';
import CassetteTag from '../ui/CassetteTag';

const { width } = Dimensions.get('window');

export default function SongRadarModal({
  visible,
  onClose,
  onOpenAddToPlaylist,
}) {
  const { playTrack } = useAudioPlayer();
  const { likedTrackIds = [], toggleLikeTrack } = useUser();
  const { isDark } = useTheme();
  const { showToast } = useToast();

  // States: 'idle' | 'listening' | 'analyzing' | 'success' | 'error'
  const [radarState, setRadarState] = useState('idle');
  const [countdown, setCountdown] = useState(6);
  const [matchedTrack, setMatchedTrack] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const recordingRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const recordingTimeoutRef = useRef(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  const pulseOpacity = useRef(new Animated.Value(0.8)).current;

  // Radar Pulse Animation
  useEffect(() => {
    let loop = null;
    if (radarState === 'listening') {
      pulseAnim.setValue(0.8);
      pulseOpacity.setValue(0.8);
      loop = Animated.loop(
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 2.0,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0);
    }

    return () => {
      if (loop) loop.stop();
    };
  }, [radarState]);

  // Clean stop recording & reset audio mode
  const stopRecordingSafely = async () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);

    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording) {
          await recordingRef.current.stopAndUnloadAsync();
        }
      } catch {}
      recordingRef.current = null;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch {}
  };

  const resetModal = () => {
    stopRecordingSafely();
    setRadarState('idle');
    setCountdown(6);
    setMatchedTrack(null);
    setMatchDetails(null);
    setErrorMessage('');
  };

  useEffect(() => {
    if (visible) {
      resetModal();
    } else {
      stopRecordingSafely();
    }
    return () => {
      stopRecordingSafely();
    };
  }, [visible]);

  // Start Audio Recording
  const startListening = async () => {
    await stopRecordingSafely();
    setErrorMessage('');
    setRadarState('listening');
    setCountdown(6);

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setRadarState('error');
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in system settings to use Song Radar.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      await recording.startAsync();

      // Countdown timer
      let timeLeft = 6;
      countdownIntervalRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(countdownIntervalRef.current);
        }
      }, 1000);

      // Stop automatically after 6 seconds and analyze
      recordingTimeoutRef.current = setTimeout(async () => {
        try {
          if (recordingRef.current) {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;
            await analyzeRecording(uri);
          }
        } catch (e) {
          setRadarState('error');
          setErrorMessage(e.message || 'Error capturing audio recording.');
        }
      }, 6500);

    } catch (err) {
      await stopRecordingSafely();
      setRadarState('error');
      setErrorMessage(err.message || 'Unable to access microphone on this device.');
    }
  };

  // Upload to /api/recognize and analyze
  const analyzeRecording = async (uri) => {
    if (!uri) {
      setRadarState('error');
      setErrorMessage('No audio recording found.');
      return;
    }

    setRadarState('analyzing');
    try {
      const uploadUrl = `${API_BASE_URL.replace(/\/$/, '')}/api/recognize`;
      const response = await FileSystem.uploadAsync(uploadUrl, uri, {
        fieldName: 'audio',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status !== 200) {
        throw new Error(`Server returned error status ${response.status}`);
      }

      const data = JSON.parse(response.body);

      if (data.success && data.matched && data.title) {
        setMatchedTrack(data.track);
        setMatchDetails({
          title: data.title,
          artist: data.artist || 'Unknown Artist',
          album: data.album || 'Single',
          cover: data.cover || data.track?.cover,
          confidence: data.confidence ? Math.round(data.confidence * 100) : 96,
        });
        setRadarState('success');
      } else {
        setRadarState('error');
        setErrorMessage(data.message || 'Could not recognize the song. Please try moving closer to the speaker or singing louder.');
      }
    } catch (err) {
      setRadarState('error');
      setErrorMessage(err.message || 'Network error while analyzing audio. Please check your connection.');
    } finally {
      // Remove temporary recording file
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {}
    }
  };

  // Play matched track
  const handlePlayNow = () => {
    if (matchedTrack && playTrack) {
      playTrack(matchedTrack);
      onClose();
      if (showToast) showToast(`Now Playing: ${matchedTrack.title}`, 'success');
    }
  };

  // Toggle Like
  const trackId = String(matchedTrack?._id || matchedTrack?.id || '');
  const isLiked = Array.isArray(likedTrackIds) ? likedTrackIds.includes(trackId) : false;

  const handleToggleLike = async () => {
    if (trackId && toggleLikeTrack) {
      await toggleLikeTrack(trackId);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetOuter}>
          <View style={styles.hardShadow} />
          
          <View style={[styles.sheet, !isDark && styles.sheetLight]}>
            {/* Header */}
            <View style={[styles.header, !isDark && styles.headerLight]}>
              <View style={styles.headerTitleBox}>
                <View style={styles.radarIconWrap}>
                  <Radio size={14} color="#10b981" />
                </View>
                <Text style={styles.headerTitle}>RIVO SONG RADAR</Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  stopRecordingSafely();
                  onClose();
                }}
                style={[styles.closeBtn, !isDark && styles.closeBtnLight]}
              >
                <X size={18} color={!isDark ? '#0b1110' : colors.textWhite} />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <View style={styles.body}>

              {/* ─────────────────────────────────────────────────── */}
              {/* STATE 1: IDLE */}
              {/* ─────────────────────────────────────────────────── */}
              {radarState === 'idle' && (
                <View style={styles.stateContainer}>
                  <View style={styles.iconCircle}>
                    <Mic size={36} color="#10b981" />
                  </View>

                  <Text style={[styles.stateTitle, !isDark && styles.textDark]}>
                    Acoustic & Humming Search
                  </Text>
                  <Text style={[styles.stateSubtitle, !isDark && styles.textDarkMuted]}>
                    Hold your phone near music playing around you, or sing & hum the melody into the microphone.
                  </Text>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    activeOpacity={0.85}
                    onPress={startListening}
                  >
                    <Radio size={16} color="#0b1110" />
                    <Text style={styles.primaryBtnText}>START LISTENING</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ─────────────────────────────────────────────────── */}
              {/* STATE 2: LISTENING */}
              {/* ─────────────────────────────────────────────────── */}
              {radarState === 'listening' && (
                <View style={styles.stateContainer}>
                  <View style={styles.radarAnimationBox}>
                    <Animated.View
                      style={[
                        styles.pulseRing,
                        {
                          transform: [{ scale: pulseAnim }],
                          opacity: pulseOpacity,
                        },
                      ]}
                    />
                    <View style={styles.listeningCenterCircle}>
                      <Mic size={34} color="#0b1110" />
                    </View>
                  </View>

                  <Text style={[styles.stateTitle, { color: '#10b981' }]}>
                    Listening for Audio...
                  </Text>
                  <Text style={[styles.stateSubtitle, !isDark && styles.textDarkMuted]}>
                    Hold your phone close to the music source or sing the lyrics.
                  </Text>

                  <View style={styles.timerBadge}>
                    <View style={styles.greenDot} />
                    <Text style={styles.timerText}>{countdown}s remaining</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.cancelBtn, !isDark && styles.cancelBtnLight]}
                    onPress={resetModal}
                  >
                    <Text style={[styles.cancelBtnText, !isDark && styles.textDark]}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ─────────────────────────────────────────────────── */}
              {/* STATE 3: ANALYZING */}
              {/* ─────────────────────────────────────────────────── */}
              {radarState === 'analyzing' && (
                <View style={[styles.stateContainer, { paddingVertical: 28 }]}>
                  <ActivityIndicator size="large" color="#10b981" style={{ marginBottom: 16 }} />
                  <Text style={[styles.stateTitle, !isDark && styles.textDark]}>
                    Analyzing Audio...
                  </Text>
                  <Text style={[styles.stateSubtitle, !isDark && styles.textDarkMuted]}>
                    Extracting acoustic fingerprint and matching against global music catalogs & AI melody contours...
                  </Text>
                </View>
              )}

              {/* ─────────────────────────────────────────────────── */}
              {/* STATE 4: SUCCESS / MATCHED */}
              {/* ─────────────────────────────────────────────────── */}
              {radarState === 'success' && matchDetails && (
                <View style={styles.stateContainer}>
                  {/* Badge */}
                  <View style={styles.matchBadge}>
                    <CheckCircle2 size={13} color="#10b981" />
                    <Text style={styles.matchBadgeText}>
                      Track Identified • {matchDetails.confidence}% Match
                    </Text>
                  </View>

                  {/* Album Cover & Details */}
                  <View style={styles.trackCard}>
                    <View style={styles.coverBox}>
                      {matchDetails.cover ? (
                        <Image
                          source={{ uri: normalizeCoverUri(matchDetails.cover) }}
                          style={styles.coverImage}
                        />
                      ) : (
                        <View style={styles.coverFallback}>
                          <Music size={32} color="#10b981" />
                        </View>
                      )}
                    </View>

                    <Text style={[styles.trackTitle, !isDark && styles.textDark]} numberOfLines={1}>
                      {matchDetails.title}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {matchDetails.artist}
                    </Text>
                    {matchDetails.album && matchDetails.album !== 'Single' && (
                      <Text style={styles.trackAlbum} numberOfLines={1}>
                        {matchDetails.album}
                      </Text>
                    )}
                  </View>

                  {/* Actions */}
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    activeOpacity={0.85}
                    onPress={handlePlayNow}
                  >
                    <Play size={16} color="#0b1110" fill="#0b1110" />
                    <Text style={styles.primaryBtnText}>PLAY TRACK NOW</Text>
                  </TouchableOpacity>

                  <View style={styles.secondaryActionsRow}>
                    <TouchableOpacity
                      style={[styles.secondaryBtn, isLiked && styles.likedBtn, !isDark && styles.secondaryBtnLight]}
                      onPress={handleToggleLike}
                    >
                      <Heart
                        size={14}
                        color={isLiked ? '#dc2626' : (!isDark ? '#0b1110' : colors.textWhite)}
                        fill={isLiked ? '#dc2626' : 'transparent'}
                      />
                      <Text style={[styles.secondaryBtnText, isLiked && { color: '#dc2626' }, !isDark && styles.textDark]}>
                        {isLiked ? 'LIKED' : 'LIKE'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.secondaryBtn, !isDark && styles.secondaryBtnLight]}
                      onPress={() => {
                        if (matchedTrack && onOpenAddToPlaylist) {
                          onOpenAddToPlaylist(matchedTrack);
                        }
                      }}
                    >
                      <PlusCircle size={14} color={!isDark ? '#0b1110' : colors.textWhite} />
                      <Text style={[styles.secondaryBtnText, !isDark && styles.textDark]}>PLAYLIST</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.resetBtn} onPress={resetModal}>
                    <RotateCcw size={12} color="#9ca3af" />
                    <Text style={styles.resetBtnText}>Identify Another Song</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ─────────────────────────────────────────────────── */}
              {/* STATE 5: ERROR / NO MATCH */}
              {/* ─────────────────────────────────────────────────── */}
              {radarState === 'error' && (
                <View style={styles.stateContainer}>
                  <View style={styles.errorIconCircle}>
                    <AlertCircle size={32} color="#dc2626" />
                  </View>

                  <Text style={[styles.stateTitle, { color: '#dc2626' }]}>
                    No Track Match
                  </Text>
                  <Text style={[styles.stateSubtitle, !isDark && styles.textDarkMuted]}>
                    {errorMessage || 'Could not recognize the song. Please try moving closer to the speaker or singing louder.'}
                  </Text>

                  <View style={styles.errorActionsRow}>
                    <TouchableOpacity
                      style={[styles.primaryBtn, { flex: 1 }]}
                      onPress={startListening}
                    >
                      <RotateCcw size={14} color="#0b1110" />
                      <Text style={styles.primaryBtnText}>TRY AGAIN</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.cancelBtn, !isDark && styles.cancelBtnLight]}
                      onPress={() => {
                        stopRecordingSafely();
                        onClose();
                      }}
                    >
                      <Text style={[styles.cancelBtnText, !isDark && styles.textDark]}>CLOSE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheetOuter: {
    width: '100%',
    maxWidth: 380,
    position: 'relative',
  },
  hardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: '#051916',
  },
  sheet: {
    backgroundColor: '#0b1110',
    borderWidth: 3,
    borderColor: '#10b981',
    overflow: 'hidden',
  },
  sheetLight: {
    backgroundColor: '#fdfbf7',
    borderColor: '#0b1110',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#182320',
    backgroundColor: '#070b0a',
  },
  headerLight: {
    backgroundColor: '#ede5d3',
    borderBottomColor: '#0b1110',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radarIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#10b981',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  closeBtn: {
    padding: 4,
    borderWidth: 1.5,
    borderColor: '#27272a',
    backgroundColor: '#182320',
  },
  closeBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  body: {
    padding: 20,
  },
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textWhite,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stateSubtitle: {
    fontSize: 12,
    color: colors.grayText,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
    marginBottom: 20,
  },
  textDark: {
    color: '#0b1110',
  },
  textDarkMuted: {
    color: '#57534e',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#10b981',
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#0b1110',
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0b1110',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  radarAnimationBox: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulseRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  listeningCenterCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(5, 25, 22, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 16,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#27272a',
    backgroundColor: '#141d1b',
  },
  cancelBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.grayText,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 14,
  },
  matchBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  trackCard: {
    alignItems: 'center',
    marginBottom: 16,
  },
  coverBox: {
    width: 100,
    height: 100,
    borderWidth: 2.5,
    borderColor: '#10b981',
    marginBottom: 10,
    backgroundColor: '#141d1b',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textWhite,
    textAlign: 'center',
    letterSpacing: 0.5,
    maxWidth: 280,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  trackArtist: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 280,
  },
  trackAlbum: {
    fontSize: 10,
    color: colors.grayText,
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 280,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#27272a',
    backgroundColor: '#141d1b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  likedBtn: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  secondaryBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textWhite,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 4,
  },
  resetBtnText: {
    fontSize: 11,
    color: '#9ca3af',
    textDecorationLine: 'underline',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  errorActionsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
});
