import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, HardDrive, Database, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';

const fmtGB = (bytes) => `${(Number(bytes || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`;
const fmtMB = (bytes) => `${(Number(bytes || 0) / (1024 * 1024)).toFixed(1)} MB`;

function AdminCloudPanel({ isDark, isRTL }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStatus = useCallback((refresh = false, signal) => {
    setLoading(true);
    setError('');
    const tk = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    fetch(`${API_BASE_URL}/api/admin/cloud-status${refresh ? '?refresh=1' : ''}`, {
      headers: { Authorization: `Bearer ${tk}` },
      signal
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
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadStatus(false, controller.signal);
    return () => controller.abort();
  }, [loadStatus]);

  const cardBg = isDark ? 'bg-[#182320] border-zinc-700' : 'bg-[#ede5d3] border-black';
  const subBg = isDark ? 'bg-[#111917] border-zinc-700' : 'bg-white border-black';

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-[#17a398]" size={26} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`p-5 rounded-2xl brutal-border ${cardBg} text-center font-mono text-xs text-red-400`}>
        {error}
      </div>
    );
  }

  const q = data?.quran || {};
  const db = data?.database || {};
  const vps = data?.vps || {};
  const tg = data?.telegram || {};
  const qPct = q.total > 0 ? Math.round((q.uploaded / q.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div>
          <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
            <Cloud size={18} className="text-[#17a398]" />
            {isRTL ? 'مراقبة السحابات وتقدم رفع القرآن' : 'Cloud Storage & Quran Migration Monitor'}
          </h2>
          <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
            {isRTL
              ? `التحويل التلقائي من rivoquran1 إلى rivoquran2 عند 9.2 GB • الوجهة النشطة للقرآن: ${q.activeBucket || 'rivoquran1'}`
              : `Auto-failover from rivoquran1 -> rivoquran2 at 9.2 GB • Active Quran bucket: ${q.activeBucket || 'rivoquran1'}`}
          </p>
        </div>

        <button
          onClick={() => loadStatus(true)}
          className={`px-3 py-2 rounded-xl brutal-border font-mono text-xs font-black flex items-center gap-1.5 cursor-pointer ${
            isDark ? 'bg-[#182320] text-[#17a398] border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-black border-black'
          }`}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`p-4 rounded-2xl brutal-border ${cardBg}`}>
          <p className="text-[11px] font-mono text-zinc-400 uppercase">{isRTL ? 'تقدم رفع القرآن' : 'Quran Cloud Upload'}</p>
          <p className="text-xl font-black text-[#17a398] mt-1">{q.uploaded || 0} / {q.total || 0}</p>
          <p className="text-xs font-mono text-zinc-400 mt-1">{qPct}% • {fmtGB(q.totalBytes)} ({q.remaining || 0} {isRTL ? 'متبقي' : 'left'})</p>
        </div>

        <div className={`p-4 rounded-2xl brutal-border ${cardBg}`}>
          <p className="text-[11px] font-mono text-zinc-400 uppercase">{isRTL ? 'سحابة تلجرام (موسيقى)' : 'Telegram Music Cloud'}</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{tg.count || 0}</p>
          <p className="text-xs font-mono text-zinc-400 mt-1">{fmtGB(tg.totalBytes)} • {tg.botsConfigured || 0} bots</p>
        </div>

        <div className={`p-4 rounded-2xl brutal-border ${cardBg}`}>
          <p className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1"><Database size={12} /> {isRTL ? 'قاعدة البيانات' : 'MongoDB Atlas'}</p>
          <p className="text-xl font-black mt-1">{fmtMB(db.dataSize)}</p>
          <p className="text-xs font-mono text-zinc-400 mt-1">{isRTL ? 'من' : 'of'} {fmtMB(db.capBytes)} ({db.objects || 0} docs)</p>
        </div>

        <div className={`p-4 rounded-2xl brutal-border ${cardBg}`}>
          <p className="text-[11px] font-mono text-zinc-400 uppercase flex items-center gap-1"><HardDrive size={12} /> {isRTL ? 'كاش السيرفر' : 'VPS NVMe Cache'}</p>
          <p className="text-xl font-black mt-1">{fmtGB(vps.cacheBytes)}</p>
          <p className="text-xs font-mono text-zinc-400 mt-1">{vps.cacheFiles || 0} files • {fmtGB(vps.diskFreeBytes)} {isRTL ? 'متاح' : 'free'}</p>
        </div>
      </div>

      {/* B2 Buckets Capacity */}
      <div className={`p-4 rounded-2xl brutal-border ${cardBg}`}>
        <h3 className="text-xs font-mono font-black uppercase mb-3">{isRTL ? 'حاويات Backblaze B2 (الحد المجاني 10 GB)' : 'Backblaze B2 Buckets (10 GB Free Limit)'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(data?.b2Buckets || []).map((b) => {
            const isWarn = b.status === 'near_limit' || b.status === 'switched' || b.status === 'full';
            const barColor = b.status === 'switched' || b.status === 'full' ? 'bg-amber-400' : (b.status === 'near_limit' ? 'bg-orange-400' : 'bg-[#17a398]');
            return (
              <div key={b.bucketName} className={`p-3 rounded-xl brutal-border ${subBg}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono font-black text-xs">{b.bucketName} <span className="text-zinc-400 font-normal">({b.category})</span></span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1 ${
                    b.status === 'standby' ? 'bg-zinc-700/60 text-zinc-300' : (isWarn ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300')
                  }`}>
                    {isWarn ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                    {b.status === 'switched' ? 'Switched >= 9.2GB' : b.status.toUpperCase()}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden mb-1.5">
                  <div className={`h-full ${barColor}`} style={{ width: `${Math.max(2, b.percentOfCap)}%` }} />
                </div>
                <div className="flex justify-between text-xs font-mono text-zinc-400">
                  <span>{fmtGB(b.totalBytes)} / 10.00 GB ({b.percentOfCap}%)</span>
                  <span>{b.count} files</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quran Reciters Breakdown & Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`p-4 rounded-2xl brutal-border ${cardBg}`}>
          <h3 className="text-xs font-mono font-black uppercase mb-3">{isRTL ? 'تفصيل المصاحف حسب القارئ' : 'Quran Progress by Reciter'}</h3>
          <div className="space-y-2">
            {(q.reciters || []).map((r) => {
              const total = r.uploaded + r.remaining;
              const pct = total > 0 ? Math.round((r.uploaded / total) * 100) : 0;
              return (
                <div key={r.artist} className={`p-2.5 rounded-xl brutal-border ${subBg}`}>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="truncate">{r.artist}</span>
                    <span className="font-mono text-[#17a398]">{r.uploaded} / {total} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                    <div className="h-full bg-[#17a398]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`p-4 rounded-2xl brutal-border ${cardBg}`}>
          <h3 className="text-xs font-mono font-black uppercase mb-3">{isRTL ? 'أحدث الملفات المرفوعة للسحابة' : 'Recent Cloud Migrations'}</h3>
          <div className="space-y-2">
            {(data?.migration?.recentTracks || []).map((tr) => (
              <div key={tr.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-xl brutal-border ${subBg}`}>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{tr.title}</p>
                  <p className="text-[11px] font-mono text-zinc-400 truncate">{tr.artist} • {tr.bucketName || tr.provider}</p>
                </div>
                <span className="text-xs font-mono text-[#17a398] shrink-0">{fmtMB(tr.fileSize)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(AdminCloudPanel);
