import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0e1715',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: '#263330',
    borderBottomWidth: 0,
    maxHeight: '85%',
    minHeight: '55%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c2825',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  arabicHeaderTitle: {
    letterSpacing: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  headerSub: {
    color: '#17a398',
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  arabicHeaderSub: {
    letterSpacing: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshBtn: {
    padding: 6,
  },
  closeBtn: {
    backgroundColor: '#162220',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 38,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    color: '#ffffff',
    fontSize: 12.5,
  },
  arabicSearchInput: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 24,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyDesc: {
    color: '#94a3b8',
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Light Theme Adaptations
  containerLight: {
    backgroundColor: '#f4ede1',
    borderColor: '#0b1110',
  },
  headerLight: {
    borderBottomColor: '#d6c8b0',
  },
  headerTitleLight: {
    color: '#0b1110',
  },
  closeBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  searchBoxLight: {
    backgroundColor: '#fdfbf7',
    borderColor: '#0b1110',
  },
  searchInputLight: {
    color: '#0b1110',
  },
  emptyTitleLight: {
    color: '#0b1110',
  },
  emptyDescLight: {
    color: '#57534e',
  },
});
