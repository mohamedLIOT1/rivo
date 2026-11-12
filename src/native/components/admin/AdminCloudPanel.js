import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Cloud, RefreshCw, HardDrive, Database, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { API_BASE_URL } from '../../config';
import { colors } from '../../theme/colors';

const fmtGB = (bytes) => `${(Number(bytes || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`;
const fmtMB = (bytes) => `${(Number(bytes || 0) / (1024 * 1024)).toFixed(1)} MB`;

function AdminCloudPanel({ token, isDark, isRTL, rtlTextStyle }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStatus = useCallback((refresh = false, signal) => {
    if (!token) return;
    setLoading(true);
    setError('');
    fetch(`${API_BASE_URL}/api/admin/cloud-status${refresh ? '?refresh=1' : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
      .then((r) => r.json())
      .then((res) => {
        if (signal?.aborted) return;
        if (res.success) setData(res.data);
        else setError(res.error || 'Failed to load cloud metrics');
      })
      .catch((e) => {
        if (!signal?.aborted) setError(e.message || 'Network error');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    loadStatus(false, controller.signal);
    return () => controller.abort();
  }, [loadStatus]);

  if (loading && !data) {
    return <ActivityIndicator size="large" color={colors.mint} style={{ marginTop: 28 }} />;
  }

  if (error && !data) {
    return <Text style={[styles.errText, rtlTextStyle]}>{error}</Text>;
  }

  const q = data?.quran || {};
  const db = data?.database || {};
  const vps = data?.vps || {};
  const tg = data?.telegram || {};
  const qPct = q.total > 0 ? Math.round((q.uploaded / q.total) * 100) : 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.topBar, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, !isDark && { color: '#0b1110' }, rtlTextStyle]}>
            {isRTL ? 'مراقبة السحابات والقرآن' : 'CLOUD & QURAN STORAGE'}
          </Text>
          <Text style={[styles.sub, rtlTextStyle]}>
            {isRTL
              ? `الحاوية النشطة للقرآن: ${q.activeBucket || 'rivoquran1'} (التحويل عند 9.2 GB)`
              : `Active Quran bucket: ${q.activeBucket || 'rivoquran1'} (auto-switch at 9.2 GB)`}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => loadStatus(true)} activeOpacity={0.8}>
          <RefreshCw size={12} color="#082621" />
          <Text style={[styles.refreshText, rtlTextStyle]}>{isRTL ? 'تحديث' : 'SYNC'}</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Grid */}
      <View style={styles.grid}>
        <View style={[styles.card, !isDark && styles.cardLight]}>
          <Text style={[styles.cardLabel, rtlTextStyle]}>{isRTL ? 'رفع القرآن' : 'QURAN UPLOAD'}</Text>
          <Text style={[styles.cardValue, { color: '#17a398' }]}>{q.uploaded || 0} / {q.total || 0}</Text>
          <Text style={[styles.cardMeta, rtlTextStyle]}>{qPct}% • {fmtGB(q.totalBytes)}</Text>
        </View>

        <View style={[styles.card, !isDark && styles.cardLight]}>
          <Text style={[styles.cardLabel, rtlTextStyle]}>{isRTL ? 'موسيقى تلجرام' : 'TELEGRAM MUSIC'}</Text>
          <Text style={[styles.cardValue, { color: '#10b981' }]}>{tg.count || 0}</Text>
          <Text style={[styles.cardMeta, rtlTextStyle]}>{fmtGB(tg.totalBytes)} • {tg.botsConfigured || 0} bots</Text>
        </View>

        <View style={[styles.card, !isDark && styles.cardLight]}>
          <View style={styles.rowGap}>
            <Database size={12} color="#9ca3af" />
            <Text style={[styles.cardLabel, rtlTextStyle]}>{isRTL ? 'قاعدة البيانات' : 'DATABASE'}</Text>
          </View>
          <Text style={[styles.cardValue, !isDark && { color: '#0b1110' }]}>{fmtMB(db.dataSize)}</Text>
          <Text style={[styles.cardMeta, rtlTextStyle]}>{isRTL ? 'الحد المجاني' : 'Cap'} {fmtMB(db.capBytes)}</Text>
        </View>

        <View style={[styles.card, !isDark && styles.cardLight]}>
          <View style={styles.rowGap}>
            <HardDrive size={12} color="#9ca3af" />
            <Text style={[styles.cardLabel, rtlTextStyle]}>{isRTL ? 'كاش السيرفر' : 'VPS CACHE'}</Text>
          </View>
          <Text style={[styles.cardValue, !isDark && { color: '#0b1110' }]}>{fmtGB(vps.cacheBytes)}</Text>
          <Text style={[styles.cardMeta, rtlTextStyle]}>{fmtGB(vps.diskFreeBytes)} {isRTL ? 'متاح' : 'free'}</Text>
        </View>
      </View>

      {/* B2 Buckets */}
      <View style={[styles.sectionCard, !isDark && styles.cardLight]}>
        <View style={styles.rowGap}>
          <Cloud size={14} color={colors.mint} />
          <Text style={[styles.sectionTitle, !isDark && { color: '#0b1110' }, rtlTextStyle]}>
            {isRTL ? 'حاويات التخزين السحابي (حد 10 GB)' : 'B2 BUCKETS (10 GB LIMIT)'}
          </Text>
        </View>

        {(data?.b2Buckets || []).map((b) => {
          const isWarn = b.status === 'near_limit' || b.status === 'switched' || b.status === 'full';
          return (
            <View key={b.bucketName} style={styles.bucketRow}>
              <View style={styles.bucketHeader}>
                <Text style={[styles.bucketName, !isDark && { color: '#0b1110' }]}>
                  {b.bucketName} ({b.category})
                </Text>
                <View style={[styles.badge, isWarn ? styles.badgeWarn : (b.status === 'standby' ? styles.badgeIdle : styles.badgeOk)]}>
                  {isWarn ? <AlertTriangle size={10} color="#fbbf24" /> : <CheckCircle2 size={10} color="#34d399" />}
                  <Text style={styles.badgeText}>{b.status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(3, b.percentOfCap)}%`, backgroundColor: isWarn ? '#f59e0b' : '#17a398' }]} />
              </View>
              <Text style={styles.bucketMeta}>{fmtGB(b.totalBytes)} / 10.00 GB ({b.percentOfCap}%) • {b.count} files</Text>
            </View>
          );
        })}
      </View>

      {/* Reciters */}
      <View style={[styles.sectionCard, !isDark && styles.cardLight]}>
        <Text style={[styles.sectionTitle, !isDark && { color: '#0b1110' }, rtlTextStyle]}>
          {isRTL ? 'تقدم المصاحف حسب القارئ' : 'QURAN BY RECITER'}
        </Text>
        {(q.reciters || []).map((r) => {
          const total = r.uploaded + r.remaining;
          const pct = total > 0 ? Math.round((r.uploaded / total) * 100) : 0;
          return (
            <View key={r.artist} style={styles.reciterRow}>
              <View style={styles.bucketHeader}>
                <Text style={[styles.reciterName, !isDark && { color: '#0b1110' }]} numberOfLines={1}>{r.artist}</Text>
                <Text style={styles.reciterPct}>{r.uploaded}/{total} ({pct}%)</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(2, pct)}%`, backgroundColor: '#17a398' }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: '#fff', fontSize: 13, fontWeight: '900' },
  sub: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#17a398', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  refreshText: { color: '#082621', fontSize: 11, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '48.5%', backgroundColor: '#121d1a', borderWidth: 1, borderColor: '#233b35', borderRadius: 14, padding: 12 },
  cardLight: { backgroundColor: '#f5efe2', borderColor: '#d6ccb8' },
  cardLabel: { color: '#9ca3af', fontSize: 10, fontWeight: '800' },
  cardValue: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 4 },
  cardMeta: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionCard: { backgroundColor: '#121d1a', borderWidth: 1, borderColor: '#233b35', borderRadius: 14, padding: 12, gap: 10 },
  sectionTitle: { color: '#fff', fontSize: 12, fontWeight: '900' },
  bucketRow: { gap: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  bucketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bucketName: { color: '#fff', fontSize: 12, fontWeight: '800' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  badgeOk: { backgroundColor: 'rgba(16,185,129,0.18)' },
  badgeWarn: { backgroundColor: 'rgba(245,158,11,0.2)' },
  badgeIdle: { backgroundColor: 'rgba(156,163,175,0.18)' },
  badgeText: { color: '#e5e7eb', fontSize: 9, fontWeight: '800' },
  barTrack: { height: 6, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  bucketMeta: { color: '#9ca3af', fontSize: 11 },
  reciterRow: { gap: 4 },
  reciterName: { color: '#e5e7eb', fontSize: 12, fontWeight: '700', flex: 1 },
  reciterPct: { color: '#17a398', fontSize: 11, fontWeight: '800' },
  errText: { color: '#f87171', textAlign: 'center', padding: 20, fontSize: 12 },
});

export default React.memo(AdminCloudPanel);
