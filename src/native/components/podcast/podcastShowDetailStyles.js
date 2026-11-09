import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  headerContainer: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  topNavRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  topNavRowLTR: {
    flexDirection: 'row',
  },
  backBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtnLTR: {
    flexDirection: 'row',
  },
  backBtnLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  backText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  backTextLight: {
    color: '#0f172a',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  coverFrame: {
    width: 170,
    height: 170,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1b2624',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  showTitleLight: {
    color: '#0f172a',
  },
  creatorText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 8,
  },
  creatorTextLight: {
    color: '#64748b',
  },
  categoryPill: {
    backgroundColor: 'rgba(23, 163, 152, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(23, 163, 152, 0.3)',
    marginBottom: 10,
  },
  categoryPillText: {
    color: colors.mint,
    fontSize: 11,
    fontWeight: '700',
  },
  descriptionText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  descriptionTextLight: {
    color: '#475569',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statsRowLTR: {
    flexDirection: 'row',
  },
  statItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  statItemLTR: {
    flexDirection: 'row',
  },
  statText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  statTextLight: {
    color: '#64748b',
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#64748b',
  },
  actionButtonsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 8,
  },
  actionButtonsRowLTR: {
    flexDirection: 'row',
  },
  playAllBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.mint,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.mint,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  playAllBtnLTR: {
    flexDirection: 'row',
  },
  playAllBtnText: {
    color: '#0b1110',
    fontSize: 14,
    fontWeight: '800',
  },
  followBtn: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e2927',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  followBtnLTR: {
    flexDirection: 'row',
  },
  followBtnLight: {
    backgroundColor: '#f1f5f9',
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  followBtnActive: {
    borderColor: colors.mint,
    backgroundColor: 'rgba(23, 163, 152, 0.1)',
  },
  followBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  followBtnTextLight: {
    color: '#0f172a',
  },
  followBtnActiveText: {
    color: colors.mint,
    fontSize: 13,
    fontWeight: '700',
  },
  episodesHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  episodesHeaderRowLTR: {
    flexDirection: 'row',
  },
  episodesHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  episodesHeadingLight: {
    color: '#0f172a',
  },
  episodesCountText: {
    fontSize: 14,
    color: colors.mint,
    fontWeight: '700',
  },
});

export default styles;
