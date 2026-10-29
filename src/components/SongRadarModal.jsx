import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mic, Radio, Play, Heart, PlusCircle, RotateCcw, 
  CheckCircle2, AlertCircle, Loader2, Music, Sparkles 
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function SongRadarModal({
  isOpen,
  onClose,
  onSelectTrack,
  toggleLike,
  openAddToPlaylist,
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';

  // Modal States: 'idle' | 'listening' | 'analyzing' | 'success' | 'error'
  const [radarState, setRadarState] = useState('idle');
  const [countdown, setCountdown] = useState(6);
  const [matchedTrack, setMatchedTrack] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const countdownIntervalRef = useRef(null);
  const recordingTimeoutRef = useRef(null);

  // Stop active microphone tracks safely
  const stopMicrophoneStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      mediaStreamRef.current = null;
    }
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
  };

  // Reset modal state
  const resetRadar = () => {
    stopMicrophoneStream();
    setRadarState('idle');
    setCountdown(6);
    setMatchedTrack(null);
    setMatchDetails(null);
    setErrorMessage('');
    setIsLiked(false);
  };

  // Handle modal open/close
  useEffect(() => {
    if (isOpen) {
      resetRadar();
    } else {
      stopMicrophoneStream();
    }
    return () => stopMicrophoneStream();
  }, [isOpen]);

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Start Audio Recording
  const startListening = async () => {
    stopMicrophoneStream();
    audioChunksRef.current = [];
    setErrorMessage('');
    setRadarState('listening');
    setCountdown(6);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support microphone audio capture.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = stream;

      // Select supported audio mime-type
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm'
        });
        stopMicrophoneStream();
        await analyzeAudioClip(audioBlob);
      };

      recorder.start(500); // 500ms timeslices

      // Countdown timer
      let timeLeft = 6;
      countdownIntervalRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(countdownIntervalRef.current);
        }
      }, 1000);

      // Stop automatically after 6.5 seconds
      recordingTimeoutRef.current = setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 6500);

    } catch (err) {
      stopMicrophoneStream();
      setRadarState('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser address bar and try again.');
      } else {
        setErrorMessage(err.message || 'Unable to access the microphone. Please check your audio input device.');
      }
    }
  };

  // Analyze the recorded audio clip via backend
  const analyzeAudioClip = async (blob) => {
    setRadarState('analyzing');
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'radar_sample.webm');

      const response = await fetch(`${API_BASE_URL}/api/recognize`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Recognition server responded with status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.matched && data.title) {
        setMatchedTrack(data.track);
        setMatchDetails({
          title: data.title,
          artist: data.artist || 'Unknown Artist',
          album: data.album || 'Single',
          cover: data.cover || data.track?.cover,
          confidence: data.confidence ? Math.round(data.confidence * 100) : 96,
          source: data.source
        });
        setIsLiked(Boolean(data.track?.liked));
        setRadarState('success');
      } else {
        setRadarState('error');
        setErrorMessage(data.message || 'Could not identify the song. Try moving closer to the speaker or humming clearer.');
      }
    } catch (err) {
      setRadarState('error');
      setErrorMessage(err.message || 'Network error while analyzing audio. Please verify your connection.');
    }
  };

  // Trigger Play
  const handlePlayNow = () => {
    if (matchedTrack && onSelectTrack) {
      onSelectTrack(matchedTrack);
      onClose();
    }
  };

  // Trigger Like
  const handleToggleLike = () => {
    if (matchedTrack && toggleLike) {
      toggleLike(matchedTrack);
      setIsLiked(!isLiked);
    }
  };

  // Trigger Add to Playlist
  const handleAddToPlaylist = () => {
    if (matchedTrack && openAddToPlaylist) {
      openAddToPlaylist(matchedTrack);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-200">
      
      {/* Modal Card */}
      <div className={`w-full max-w-md brutal-border-thick brutal-shadow-lg relative overflow-hidden transition-all ${
        isDark ? 'bg-[#0b1110] text-white border-zinc-700' : 'bg-[#fdfbf7] text-[#082621] border-black'
      }`}>
        
        {/* Top Header Bar */}
        <div className={`flex items-center justify-between px-4 sm:px-5 py-3 border-b ${
          isDark ? 'border-zinc-800 bg-[#070b0a]' : 'border-black bg-[#ede5d3]'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio size={14} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-mono text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-400">
                Song Radar
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              stopMicrophoneStream();
              onClose();
            }}
            className={`p-1.5 brutal-border brutal-btn transition cursor-pointer ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-zinc-100 text-black'
            }`}
            title="Close Song Radar"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 text-center">

          {/* ──────────────────────────────────────────────────────────── */}
          {/* STATE 1: IDLE / READY */}
          {/* ──────────────────────────────────────────────────────────── */}
          {radarState === 'idle' && (
            <div className="py-2">
              {/* Radar Circle */}
              <div className="relative w-32 h-32 mx-auto mb-5 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping opacity-25" />
                <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <Mic size={36} strokeWidth={2.2} />
                </div>
              </div>

              <h4 className="font-mono text-base font-black uppercase tracking-wide mb-1">
                Acoustic & Humming Search
              </h4>
              <p className={`text-xs max-w-xs mx-auto leading-relaxed mb-6 font-sans ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                Play a song near your microphone or hum/sing the melody clearly to identify and stream it instantly.
              </p>

              <button
                onClick={startListening}
                className="w-full py-3 px-5 font-mono text-xs font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                <Radio size={15} />
                <span>Start Listening</span>
              </button>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* STATE 2: LISTENING & RECORDING */}
          {/* ──────────────────────────────────────────────────────────── */}
          {radarState === 'listening' && (
            <div className="py-2">
              {/* Pulsing Visualizer */}
              <div className="relative w-32 h-32 mx-auto mb-5 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-40" />
                <div className="w-24 h-24 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-xl shadow-emerald-500/30">
                  <Mic size={38} className="animate-bounce" />
                </div>
              </div>

              {/* Dynamic Soundwave Bars */}
              <div className="flex items-center justify-center gap-1.5 h-10 mb-4">
                {[60, 90, 40, 100, 75, 45, 85, 30, 95].map((height, i) => (
                  <span
                    key={i}
                    className="w-1.5 bg-emerald-400 rounded-full transition-all duration-150 animate-pulse"
                    style={{
                      height: `${Math.max(12, Math.min(38, height))}px`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>

              <h4 className="font-mono text-base font-black uppercase tracking-wide text-emerald-400 mb-1">
                Listening for Audio...
              </h4>
              <p className={`text-xs max-w-xs mx-auto font-sans mb-4 ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                Hold your device close to the audio source or sing the lyrics.
              </p>

              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950/70 border border-emerald-800 text-emerald-300 font-mono text-xs font-bold rounded-full mb-5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{countdown}s remaining</span>
              </div>

              <div>
                <button
                  onClick={resetRadar}
                  className={`px-4 py-1.5 font-mono text-[11px] font-bold uppercase brutal-border transition ${
                    isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-200 text-black hover:bg-zinc-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* STATE 3: ANALYZING AUDIO */}
          {/* ──────────────────────────────────────────────────────────── */}
          {radarState === 'analyzing' && (
            <div className="py-8">
              <div className="w-16 h-16 mx-auto mb-4 text-emerald-400 flex items-center justify-center">
                <Loader2 size={44} className="animate-spin" />
              </div>
              <h4 className="font-mono text-base font-black uppercase tracking-wide mb-1 text-white">
                Analyzing Audio...
              </h4>
              <p className={`text-xs max-w-xs mx-auto font-sans ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                Extracting acoustic fingerprint and matching against global catalogs & AI melody contours...
              </p>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* STATE 4: SUCCESS / TRACK IDENTIFIED */}
          {/* ──────────────────────────────────────────────────────────── */}
          {radarState === 'success' && matchDetails && (
            <div className="py-1">
              
              {/* Match Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-mono text-[11px] font-black uppercase rounded-full mb-4">
                <CheckCircle2 size={13} />
                <span>Track Identified • {matchDetails.confidence}% Match</span>
              </div>

              {/* Album Art & Track Info */}
              <div className="flex flex-col items-center mb-5">
                <div className="w-28 h-28 sm:w-32 sm:h-32 mb-3 brutal-border-thick overflow-hidden relative shadow-lg bg-zinc-900">
                  {matchDetails.cover ? (
                    <img
                      src={matchDetails.cover}
                      alt={matchDetails.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <Music size={40} />
                    </div>
                  )}
                  <div className="absolute top-1.5 left-1.5 bg-black/70 text-emerald-400 font-mono text-[9px] px-1.5 py-0.5 border border-zinc-700">
                    RADAR
                  </div>
                </div>

                <h3 className="font-mono text-base sm:text-lg font-black uppercase tracking-tight text-white line-clamp-1 max-w-xs">
                  {matchDetails.title}
                </h3>
                <p className="font-mono text-xs font-bold text-emerald-400 line-clamp-1 max-w-xs mt-0.5">
                  {matchDetails.artist}
                </p>
                {matchDetails.album && matchDetails.album !== 'Single' && (
                  <p className="text-[11px] text-zinc-500 line-clamp-1 max-w-xs mt-0.5">
                    {matchDetails.album}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handlePlayNow}
                  className="w-full py-2.5 px-4 font-mono text-xs font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
                >
                  <Play size={14} className="fill-current" />
                  <span>Play Track Now</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleToggleLike}
                    className={`py-2 px-3 font-mono text-[11px] font-black uppercase brutal-border brutal-btn flex items-center justify-center gap-1.5 transition ${
                      isLiked 
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                        : isDark ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800' : 'bg-white text-black hover:bg-zinc-100'
                    }`}
                  >
                    <Heart size={13} className={isLiked ? 'fill-current text-rose-500' : ''} />
                    <span>{isLiked ? 'Liked' : 'Like'}</span>
                  </button>

                  <button
                    onClick={handleAddToPlaylist}
                    className={`py-2 px-3 font-mono text-[11px] font-black uppercase brutal-border brutal-btn flex items-center justify-center gap-1.5 transition ${
                      isDark ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800' : 'bg-white text-black hover:bg-zinc-100'
                    }`}
                  >
                    <PlusCircle size={13} />
                    <span>Playlist</span>
                  </button>
                </div>
              </div>

              {/* Reset to Identify Another Song */}
              <div className="mt-4 pt-3 border-t border-zinc-800/80">
                <button
                  onClick={resetRadar}
                  className="font-mono text-[11px] text-zinc-400 hover:text-emerald-400 flex items-center justify-center gap-1.5 mx-auto transition cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Identify Another Song</span>
                </button>
              </div>

            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* STATE 5: ERROR / NO MATCH FOUND */}
          {/* ──────────────────────────────────────────────────────────── */}
          {radarState === 'error' && (
            <div className="py-3">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle size={24} />
              </div>

              <h4 className="font-mono text-sm font-black uppercase tracking-wide text-rose-400 mb-1">
                No Track Match
              </h4>

              <p className={`text-xs max-w-xs mx-auto leading-relaxed font-sans mb-5 ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                {errorMessage || 'Could not recognize the song. Please try moving closer to the speaker or singing louder.'}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={startListening}
                  className="flex-1 py-2.5 px-3 font-mono text-xs font-black uppercase bg-emerald-500 hover:bg-emerald-400 text-black brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Try Again</span>
                </button>

                <button
                  onClick={() => {
                    stopMicrophoneStream();
                    onClose();
                  }}
                  className={`py-2.5 px-4 font-mono text-xs font-black uppercase brutal-border transition ${
                    isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-200 text-black hover:bg-zinc-300'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
