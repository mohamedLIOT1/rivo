import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Zap, Download, RefreshCw, X, ArrowUpCircle } from 'lucide-react-native';
import { useUpdate } from '../../context/UpdateContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../context/LocalizationContext';

const UpdateBanner = React.memo(function UpdateBanner() {
  const {
    isUpdateAvailable,
    updateType,
    targetVersion,
    runningVersion,
    otaUpdateInfo,
    updateInfo,
    isDownloading,
    downloadProgress,
    downloadBytes,
    isOtaReadyToRestart,
    error,
    startUpdate,
    applyRestart,
    openUpdateModal,
    isBannerDismissed,
    dismissBanner,
  } = useUpdate();

  const { isDark } = useTheme();
  const { isRTL } = useTranslation();

  if (!isUpdateAvailable || isBannerDismissed) {
    return null;
  }

  const isOta = updateType === 'ota';
  const notes = isOta
    ? (isRTL ? otaUpdateInfo?.notes : (otaUpdateInfo?.notesEn || otaUpdateInfo?.notes))
    : (updateInfo?.releaseNotes || (isRTL ? 'تحسينات وإصلاحات جديدة' : 'New improvements and bug fixes.'));

  const pct = Math.round((downloadProgress || 0) * 100);
  const sizeMb = otaUpdateInfo?.sizeMb || (downloadBytes?.total > 0 ? `${(downloadBytes.total / 1048576).toFixed(1)} MB` : null);

  const rtlTextStyle = isRTL
    ? { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', textAlign: 'right' }
    : null;

  return (
    <View style={[styles.container, !isDark && styles.containerLight]}>
      {/* Header Row: Badge, Title & Dismiss */}
      <View style={[styles.headerRow, isRTL && styles.headerRowRTL]}>
        <View style={styles.titleGroup}>
          <View style={[styles.iconWrap, isOta ? styles.iconWrapOta : styles.iconWrapApk]}>
            {isOta ? (
              <Zap size={14} color="#17a398" strokeWidth={2.5} />
            ) : (
              <Download size={14} color="#f59e0b" strokeWidth={2.5} />
            )}
          </View>
          <View style={styles.textGroup}>
            <View style={styles.badgeRow}>
              <Text style={[styles.title, !isDark && styles.titleLight, rtlTextStyle]}>
                {isRTL ? `تحديث جديد متاح v${targetVersion}` : `Update Available v${targetVersion}`}
              </Text>
              <View style={[styles.typeBadge, isOta ? styles.typeBadgeOta : styles.typeBadgeApk]}>
                <Text style={[styles.typeBadgeText, isOta ? styles.typeBadgeTextOta : styles.typeBadgeTextApk]}>
                  {isOta ? (isRTL ? '⚡ فوري (OTA)' : '⚡ Fast OTA') : (isRTL ? '📦 تثبيت APK' : '📦 Full APK')}
                </Text>
              </View>
            </View>
            {runningVersion && (
              <Text style={[styles.versionSubtitle, !isDark && styles.versionSubtitleLight]}>
                {isRTL ? `الإصدار الحالي: v${runningVersion}` : `Current: v${runningVersion}`}
                {sizeMb ? ` • ${sizeMb}` : ''}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={dismissBanner}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <X size={16} color={isDark ? '#94a3b8' : '#64748b'} />
        </TouchableOpacity>
      </View>

      {/* Release Notes Preview */}
      {notes && (
        <Text
          numberOfLines={2}
          style={[styles.notesText, !isDark && styles.notesTextLight, rtlTextStyle]}
        >
          {notes}
        </Text>
      )}

      {/* Error message if any */}
      {error && (
        <Text style={[styles.errorText, rtlTextStyle]}>
          {error}
        </Text>
      )}

      {/* Progress or Actions */}
      {isOtaReadyToRestart ? (
        <TouchableOpacity
          style={styles.restartBtn}
          onPress={applyRestart}
          activeOpacity={0.85}
        >
          <RefreshCw size={14} color="#0b1110" strokeWidth={2.5} />
          <Text style={[styles.restartBtnText, rtlTextStyle]}>
            {isRTL ? '🚀 إعادة التشغيل لتطبيق التحديث الآن' : '🚀 Restart to Apply Update Now'}
          </Text>
        </TouchableOpacity>
      ) : isDownloading ? (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabelText}>
              {isRTL ? `جاري التنزيل... ${pct}%` : `Downloading... ${pct}%`}
            </Text>
            {downloadBytes?.total > 0 && (
              <Text style={styles.progressBytesText}>
                {`${(downloadBytes.written / 1048576).toFixed(1)} / ${(downloadBytes.total / 1048576).toFixed(1)} MB`}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.btnRow, isRTL && styles.btnRowRTL]}>
          <TouchableOpacity
            style={styles.updateNowBtn}
            onPress={startUpdate}
            activeOpacity={0.85}
          >
            {isOta ? (
              <Zap size={14} color="#0b1110" strokeWidth={2.5} />
            ) : (
              <Download size={14} color="#0b1110" strokeWidth={2.5} />
            )}
            <Text style={[styles.updateNowBtnText, rtlTextStyle]}>
              {isOta ? (isRTL ? 'تحديث فوري الآن' : 'Fast Update Now') : (isRTL ? 'تنزيل وتثبيت' : 'Download & Install')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.detailsBtn, !isDark && styles.detailsBtnLight]}
            onPress={openUpdateModal}
            activeOpacity={0.8}
          >
            <Text style={[styles.detailsBtnText, !isDark && styles.detailsBtnTextLight, rtlTextStyle]}>
              {isRTL ? 'التفاصيل' : 'Details'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

export default UpdateBanner;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#0f1715',
    borderWidth: 1,
    borderColor: 'rgba(23, 163, 152, 0.35)',
    shadowColor: '#17a398',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  containerLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOpacity: 0.05,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerRowRTL: {
    flexDirection: 'row-reverse',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOta: {
    backgroundColor: 'rgba(23, 163, 152, 0.18)',
  },
  iconWrapApk: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  textGroup: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  title: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  titleLight: {
    color: '#0f172a',
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeOta: {
    backgroundColor: 'rgba(23, 163, 152, 0.2)',
  },
  typeBadgeApk: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  typeBadgeTextOta: {
    color: '#17a398',
  },
  typeBadgeTextApk: {
    color: '#f59e0b',
  },
  versionSubtitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  versionSubtitleLight: {
    color: '#64748b',
  },
  closeBtn: {
    padding: 4,
    marginLeft: 6,
  },
  notesText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 10,
  },
  notesTextLight: {
    color: '#475569',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginBottom: 8,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  btnRowRTL: {
    flexDirection: 'row-reverse',
  },
  updateNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#17a398',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  updateNowBtnText: {
    color: '#0b1110',
    fontSize: 12,
    fontWeight: '700',
  },
  detailsBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailsBtnLight: {
    backgroundColor: '#e2e8f0',
    borderColor: '#cbd5e1',
  },
  detailsBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsBtnTextLight: {
    color: '#334155',
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  restartBtnText: {
    color: '#0b1110',
    fontSize: 12,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#17a398',
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressLabelText: {
    color: '#17a398',
    fontSize: 11,
    fontWeight: '600',
  },
  progressBytesText: {
    color: '#64748b',
    fontSize: 11,
  },
});
