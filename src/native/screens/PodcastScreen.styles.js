import { StyleSheet, Platform } from 'react-native';
import { colors } from '../theme/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
  },
  containerLight: {
    backgroundColor: '#f8fafc',
  },

  // ── Header Banner ──
  headerBanner: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  titleRowLTR: {
    flexDirection: 'row',
  },
  titleIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(23, 163, 152, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(23, 163, 152, 0.3)',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  screenTitleLight: {
    color: '#0f172a',
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
  },
  screenSubtitleLTR: {
    textAlign: 'left',
  },
  screenSubtitleLight: {
    color: '#64748b',
  },

  // ── Search Bar ──
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#151e1c',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchBarLTR: {
    flexDirection: 'row',
  },
  searchBarLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#ffffff',
    textAlign: 'right',
    paddingVertical: 0,
    marginRight: 8,
  },
  searchInputLTR: {
    textAlign: 'left',
    marginRight: 0,
    marginLeft: 8,
  },
  searchInputLight: {
    color: '#0f172a',
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },

  // ── Categories Horizontal Bar ──
  categoriesContainer: {
    marginBottom: 14,
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#151e1c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryPillLTR: {
    flexDirection: 'row',
  },
  categoryPillLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(23, 163, 152, 0.18)',
    borderColor: colors.mint,
  },
  categoryPillActiveLight: {
    backgroundColor: 'rgba(23, 163, 152, 0.15)',
    borderColor: colors.mint,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  categoryLabelLight: {
    color: '#64748b',
  },
  categoryLabelActive: {
    color: colors.mint,
    fontWeight: '700',
  },

  // ── Section Headers ──
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 6,
  },
  sectionHeaderRowLTR: {
    flexDirection: 'row',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  sectionTitleLight: {
    color: '#0f172a',
  },
  sectionBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mint,
  },

  // ── Carousel Container ──
  carouselContainer: {
    marginBottom: 16,
  },
  carouselList: {
    paddingHorizontal: 16,
  },

  // ── FlatList Main Content ──
  episodesListContent: {
    paddingBottom: 110,
  },
  episodesInnerContainer: {
    paddingHorizontal: 16,
  },

  // ── Empty State ──
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconFrame: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(23, 163, 152, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyTitleLight: {
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptySubtitleLight: {
    color: '#64748b',
  },
});

export default styles;
