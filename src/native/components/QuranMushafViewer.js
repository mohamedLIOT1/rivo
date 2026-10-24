import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  PanResponder,
  Platform
} from 'react-native';
import { BookOpen, ChevronLeft, ChevronRight, Moon, Sun, AlertCircle } from 'lucide-react-native';
import { getSurahPageRange, getMushafPageUrl } from '../utils/quranMetadata';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function QuranMushafViewer({ track, globalTheme = 'dark' }) {
  const surahInfo = useMemo(() => {
    return getSurahPageRange(track?.title || track?.name || '', track?.artist || '');
  }, [track?.title, track?.name, track?.artist]);

  const startPage = surahInfo?.startPage || 1;
  const endPage = surahInfo?.endPage || 604;

  const [currentPage, setCurrentPage] = useState(startPage);
  const [viewMode, setViewMode] = useState('dark'); // 'dark' | 'clean'
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Sync to surah startPage when track changes
  useEffect(() => {
    if (surahInfo?.startPage) {
      setCurrentPage(surahInfo.startPage);
    }
  }, [surahInfo?.startPage, track?.id, track?._id]);

  // Preload adjacent pages natively
  useEffect(() => {
    if (currentPage < endPage) {
      Image.prefetch(getMushafPageUrl(currentPage + 1)).catch(() => {});
    }
    if (currentPage > startPage) {
      Image.prefetch(getMushafPageUrl(currentPage - 1)).catch(() => {});
    }
  }, [currentPage, startPage, endPage]);

  const goToNextPage = () => {
    if (currentPage < endPage) {
      setIsLoading(true);
      setCurrentPage(p => p + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > startPage) {
      setIsLoading(true);
      setCurrentPage(p => p - 1);
    }
  };

  // Swipe gesture detection (In Arabic RTL reading: swipe left -> next page, swipe right -> prev page)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          // Swiped left
          goToNextPage();
        } else if (gestureState.dx > 50) {
          // Swiped right
          goToPrevPage();
        }
      }
    })
  ).current;

  const currentImageUrl = getMushafPageUrl(currentPage);
  const isFirstPage = currentPage <= startPage;
  const isLastPage = currentPage >= endPage;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* ── TOP HEADER ── */}
      <View style={styles.header}>
        <View style={styles.surahBadge}>
          <BookOpen size={14} color="#d4af37" />
          <Text style={styles.surahName}>{surahInfo?.name || 'The Holy Quran'}</Text>
          <Text style={styles.versesBadge}>{surahInfo?.verses} Verses</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.pagePill}>
            <Text style={styles.pagePillText}>
              Page <Text style={{ color: '#ffffff', fontWeight: '900' }}>{currentPage}</Text> / {endPage}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setViewMode(v => v === 'dark' ? 'clean' : 'dark')}
            style={styles.modeBtn}
            activeOpacity={0.7}
          >
            {viewMode === 'dark' ? (
              <Moon size={14} color="#d4af37" />
            ) : (
              <Sun size={14} color="#f59e0b" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MAIN PAGE CANVAS ── */}
      <View style={[
        styles.canvas,
        viewMode === 'dark' ? styles.canvasDark : styles.canvasClean
      ]}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#d4af37" />
            <Text style={styles.loadingText}>Page {currentPage}...</Text>
          </View>
        )}

        {hasError ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={28} color="#f59e0b" />
            <Text style={styles.errorText}>Failed to load page</Text>
            <TouchableOpacity 
              style={styles.retryBtn}
              onPress={() => { setHasError(false); setIsLoading(true); }}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Image
            key={currentImageUrl}
            source={{ uri: currentImageUrl }}
            style={[
              styles.mushafImage,
              viewMode === 'dark' ? styles.mushafImageDark : { tintColor: undefined }
            ]}
            resizeMode="contain"
            onLoad={() => setIsLoading(false)}
            onError={() => { setIsLoading(false); setHasError(true); }}
          />
        )}
      </View>

      {/* ── BOTTOM CONTROLS ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={goToPrevPage}
          disabled={isFirstPage}
          style={[styles.navBtn, isFirstPage && styles.navBtnDisabled]}
          activeOpacity={0.7}
        >
          <ChevronRight size={18} color={isFirstPage ? '#4b5563' : '#d4af37'} />
          <Text style={[styles.navBtnText, isFirstPage && styles.navBtnTextDisabled]}>Previous</Text>
        </TouchableOpacity>

        <Text style={styles.surahProgressText}>
          {surahInfo?.name} • {currentPage - startPage + 1} من {endPage - startPage + 1}
        </Text>

        <TouchableOpacity
          onPress={goToNextPage}
          disabled={isLastPage}
          style={[styles.navBtnNext, isLastPage && styles.navBtnDisabled]}
          activeOpacity={0.7}
        >
          <Text style={[styles.navBtnNextText, isLastPage && styles.navBtnTextDisabled]}>التالي</Text>
          <ChevronLeft size={18} color={isLastPage ? '#4b5563' : '#070c0b'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060b0a',
    width: '100%',
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#070c0b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(194, 155, 56, 0.25)',
  },
  surahBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  surahName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#f5ecd5',
  },
  versesBadge: {
    fontSize: 10,
    color: '#d4af37',
    backgroundColor: 'rgba(194, 155, 56, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pagePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#0c1614',
    borderWidth: 1,
    borderColor: 'rgba(194, 155, 56, 0.3)',
  },
  pagePillText: {
    fontSize: 11,
    color: '#d4af37',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  modeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#0d1816',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 6,
  },
  canvasDark: {
    backgroundColor: '#070c0b',
  },
  canvasClean: {
    backgroundColor: '#faf7ee',
  },
  mushafImage: {
    width: SCREEN_WIDTH - 16,
    height: '100%',
  },
  mushafImageDark: {
    tintColor: '#ffffff',
  },
  loadingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 8,
  },
  loadingText: {
    marginTop: 6,
    fontSize: 11,
    color: '#d4af37',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#d4af37',
    borderRadius: 4,
  },
  retryBtnText: {
    color: '#070c0b',
    fontSize: 11,
    fontWeight: '900',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#070c0b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(194, 155, 56, 0.2)',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(194, 155, 56, 0.3)',
    backgroundColor: '#0d1816',
  },
  navBtnDisabled: {
    opacity: 0.3,
    borderColor: '#374151',
    backgroundColor: '#111827',
  },
  navBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#d4af37',
  },
  navBtnTextDisabled: {
    color: '#4b5563',
  },
  surahProgressText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  navBtnNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#d4af37',
  },
  navBtnNextText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#070c0b',
  },
});
