import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Platform, Linking } from 'react-native';
import { useUpdate } from '../context/UpdateContext';
import { styles } from '../theme/appStyles';

const UpdateModals = React.memo(function UpdateModals() {
  const {
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    isOtaModalOpen,
    setIsOtaModalOpen,
    updateInfo,
    otaUpdateInfo,
    runningVersion,
    isDownloading,
    downloadProgress,
    downloadBytes,
    isOtaReadyToRestart,
    error,
    startUpdate,
    applyRestart,
  } = useUpdate();

  const [isOtaDetailsExpanded, setIsOtaDetailsExpanded] = useState(false);

  const pct = Math.round((downloadProgress || 0) * 100);

  return (
    <>
      {/* ─── IN-APP AUTO-UPDATE MODAL (Global APK / IPA) ─── */}
      {isUpdateModalOpen && (
        <Modal
          visible={isUpdateModalOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            if (!isDownloading) setIsUpdateModalOpen(false);
          }}
        >
          <View style={styles.updateModalOverlay}>
            <View style={styles.updateModalBox}>
              <View style={styles.updateHeaderRow}>
                <View style={styles.updateBadge}>
                  <Text style={styles.updateBadgeText}>UPDATE AVAILABLE</Text>
                </View>
                <Text style={styles.updateTitle}>RIVO v{updateInfo?.remoteVersion}</Text>
              </View>

              <Text style={styles.updateVersionText}>
                Current: v{runningVersion} → New: v{updateInfo?.remoteVersion}
              </Text>

              <Text style={styles.updateNotesText}>
                {updateInfo?.releaseNotes}
              </Text>

              {isDownloading ? (
                <View style={styles.downloadProgressWrap}>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${pct}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.progressInfoRow}>
                    <Text style={styles.progressPctText}>{pct}%</Text>
                    {downloadBytes?.total > 0 && (
                      <Text style={styles.progressMbText}>
                        {(downloadBytes.written / 1024 / 1024).toFixed(1)} MB /{' '}
                        {(downloadBytes.total / 1024 / 1024).toFixed(1)} MB
                      </Text>
                    )}
                  </View>
                  <Text style={styles.installingNoteText}>
                    {downloadProgress >= 1
                      ? 'Launching package installer...'
                      : Platform.OS === 'ios'
                        ? 'Preparing IPA download...'
                        : 'Downloading APK update directly in app...'}
                  </Text>
                </View>
              ) : (
                <>
                  {error && (
                    <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>
                      {error}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.updateDownloadBtn}
                    onPress={startUpdate}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.updateDownloadBtnText}>
                      {Platform.OS === 'ios' ? 'OPEN DOWNLOAD IN BROWSER' : '1-CLICK IN-APP UPDATE & INSTALL'}
                    </Text>
                  </TouchableOpacity>

                  {Platform.OS !== 'ios' && (
                    <TouchableOpacity
                      style={styles.updateBrowserBtn}
                      onPress={() => {
                        if (updateInfo?.downloadUrl) Linking.openURL(updateInfo.downloadUrl);
                        setIsUpdateModalOpen(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.updateBrowserBtnText}>OPEN DOWNLOAD IN BROWSER</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.updateCancelBtn}
                    onPress={() => setIsUpdateModalOpen(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.updateCancelBtnText}>STAY ON CURRENT VERSION</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* ─── IN-APP FAST OTA UPDATE MODAL ─── */}
      {isOtaModalOpen && (
        <Modal
          visible={isOtaModalOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            if (!isDownloading) setIsOtaModalOpen(false);
          }}
        >
          <View style={styles.updateModalOverlay}>
            <View style={[styles.updateModalBox, { borderColor: '#17a398' }]}>
              <View style={styles.updateHeaderRow}>
                <View style={[styles.updateBadge, { backgroundColor: '#17a398' }]}>
                  <Text style={styles.updateBadgeText}>⚡ FAST OTA UPDATE</Text>
                </View>
                <Text style={styles.updateTitle}>RIVO v{otaUpdateInfo?.version}</Text>
              </View>

              <Text style={[styles.updateVersionText, { fontSize: 13, color: '#17a398' }]}>
                Instant in-app update {otaUpdateInfo?.sizeMb ? `(${otaUpdateInfo.sizeMb})` : (otaUpdateInfo?.bundleSize ? `(${(otaUpdateInfo.bundleSize / 1048576).toFixed(2)} MB)` : '')} • No reinstallation required
              </Text>

              {/* ─── RELEASE NOTES & CHANGELOG BOX ─── */}
              <View style={{ width: '100%', marginBottom: 16 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#162321',
                    borderWidth: 1,
                    borderColor: '#1f3d38',
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderRadius: 8,
                  }}
                  onPress={() => setIsOtaDetailsExpanded(!isOtaDetailsExpanded)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#17a398', fontSize: 12.5, fontWeight: '700' }}>
                    📋 What's New & Release Notes
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: 'bold' }}>
                    {isOtaDetailsExpanded ? '▲ Hide' : '▼ View Details'}
                  </Text>
                </TouchableOpacity>

                {isOtaDetailsExpanded && (
                  <View style={{
                    marginTop: 6,
                    backgroundColor: '#0c1413',
                    borderWidth: 1,
                    borderColor: '#1e2928',
                    borderRadius: 8,
                    padding: 12,
                  }}>
                    <ScrollView style={{ maxHeight: 110 }} nestedScrollEnabled={true}>
                      <Text style={{
                        color: '#cbd5e1',
                        fontSize: 12,
                        lineHeight: 18,
                        textAlign: 'left',
                      }}>
                        {otaUpdateInfo?.notesEn || otaUpdateInfo?.notes || 'Instant in-app OTA update • Performance enhancements, smoother audio playback, and bug fixes.'}
                      </Text>
                    </ScrollView>
                  </View>
                )}
              </View>

              {isDownloading ? (
                <View style={styles.downloadProgressWrap}>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${pct}%`, backgroundColor: '#17a398' },
                      ]}
                    />
                  </View>
                  <View style={styles.progressInfoRow}>
                    <Text style={styles.progressPctText}>{pct}%</Text>
                    {downloadBytes?.total > 0 && (
                      <Text style={styles.progressMbText}>
                        {(downloadBytes.written / 1024 / 1024).toFixed(1)} MB /{' '}
                        {(downloadBytes.total / 1024 / 1024).toFixed(1)} MB
                      </Text>
                    )}
                  </View>
                  <Text style={styles.installingNoteText}>
                    Downloading fast update in background...
                  </Text>
                </View>
              ) : isOtaReadyToRestart ? (
                <>
                  <View style={{ backgroundColor: 'rgba(23,163,152,0.15)', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                    <Text style={{ color: '#17a398', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                      ✅ Update ready! Tap below to restart & apply immediately.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.updateDownloadBtn, { backgroundColor: '#17a398' }]}
                    onPress={applyRestart}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.updateDownloadBtnText}>🚀 RESTART & APPLY UPDATE</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.updateCancelBtn}
                    onPress={() => setIsOtaModalOpen(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.updateCancelBtnText}>APPLY ON NEXT LAUNCH</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {error && (
                    <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>
                      {error}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.updateDownloadBtn}
                    onPress={startUpdate}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.updateDownloadBtnText}>⚡ FAST UPDATE NOW (2 SECONDS)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.updateCancelBtn}
                    onPress={() => setIsOtaModalOpen(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.updateCancelBtnText}>REMIND ME LATER</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}
    </>
  );
});

export default UpdateModals;
