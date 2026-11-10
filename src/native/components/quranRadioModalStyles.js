import { StyleSheet, Platform, Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#070c0b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(194, 155, 56, 0.35)',
    maxHeight: height * 0.85,
    width: '100%',
    maxWidth: 600,
    overflow: 'hidden',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  header: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 56, // Guaranteed buffer so title cannot push or overlap close button
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(194, 155, 56, 0.2)',
    minHeight: 64,
  },
  headerRtl: {
    flexDirection: 'row-reverse',
    paddingLeft: 56, // Buffer on left in RTL
    paddingRight: 16,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerTitleWrapRtl: {
    flexDirection: 'row-reverse',
  },
  titleTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  radioIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(194, 155, 56, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(194, 155, 56, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleRowRtl: {
    flexDirection: 'row-reverse',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  liveTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    flexShrink: 0,
  },
  liveTagText: {
    fontSize: 10,
    color: '#f87171',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 11,
    color: '#d4af37',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnLtr: {
    right: 16,
  },
  closeBtnRtl: {
    left: 16,
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#0a1210',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  stationItemRtl: {
    flexDirection: 'row-reverse',
  },
  stationItemActive: {
    backgroundColor: '#0f1f1a',
    borderColor: '#c29b38',
  },
  stationThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#061310',
    borderWidth: 1,
    borderColor: 'rgba(194, 155, 56, 0.25)',
    flexShrink: 0,
  },
  stationThumb: {
    width: '100%',
    height: '100%',
  },
  stationThumbFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#061310',
  },
  playingIndicator: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d4af37',
  },
  stationInfo: {
    flex: 1,
    minWidth: 0,
  },
  stationInfoLtr: {
    marginLeft: 12,
    marginRight: 8,
  },
  stationInfoRtl: {
    marginRight: 12,
    marginLeft: 8,
  },
  stationTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  stationTitleActive: {
    color: '#d4af37',
  },
  stationArtist: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  stationDesc: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playBtnActive: {
    backgroundColor: '#d4af37',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
