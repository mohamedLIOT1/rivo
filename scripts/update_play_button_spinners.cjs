const fs = require('fs');
const path = require('path');

// 1. Update HomeTrackCard.jsx
const htcPath = path.join(__dirname, '..', 'src', 'components', 'HomeTrackCard.jsx');
let htc = fs.readFileSync(htcPath, 'utf8').replace(/\r\n/g, '\n');

// Import Loader2 & useAudioPlayer
htc = htc.replace(
  "import { Play, Pause, Heart, MoreVertical } from 'lucide-react';",
  "import { Play, Pause, Heart, MoreVertical, Loader2 } from 'lucide-react';\nimport { useAudioPlayer } from '../context/AudioContext';"
);

// Read isLoadingTrack inside component
htc = htc.replace(
  "const HomeTrackCard = memo(function HomeTrackCard({",
  "const HomeTrackCard = memo(function HomeTrackCard({\n"
);

// Inject isLoadingTrack
const hookInject = `  const { isLoadingTrack } = useAudioPlayer();\n  const durationFormatted = track.duration`;
htc = htc.replace("  const durationFormatted = track.duration", hookInject);

// Button condition
const oldBtn = `{isActive && isPlaying ? (
            <>
              <Pause size={12} fill="currentColor" />
              <span>{t('home.pause')}</span>
            </>
          ) : (
            <>
              <Play size={12} fill="currentColor" />
              <span>{t('home.play')}</span>
            </>
          )}`;

const newBtn = `{isActive && isLoadingTrack ? (
            <>
              <Loader2 size={12} className="animate-spin text-[#0b1110]" />
              <span>{t('home.loading') || 'Loading...'}</span>
            </>
          ) : isActive && isPlaying ? (
            <>
              <Pause size={12} fill="currentColor" />
              <span>{t('home.pause')}</span>
            </>
          ) : (
            <>
              <Play size={12} fill="currentColor" />
              <span>{t('home.play')}</span>
            </>
          )}`;

if (htc.includes(oldBtn)) {
  htc = htc.replace(oldBtn, newBtn);
  fs.writeFileSync(htcPath, htc.replace(/\n/g, '\r\n'), 'utf8');
  console.log('HomeTrackCard.jsx updated');
} else {
  console.log('HomeTrackCard.jsx button pattern not found');
}

// 2. Update SearchScreen.jsx
const ssPath = path.join(__dirname, '..', 'src', 'screens', 'SearchScreen.jsx');
let ss = fs.readFileSync(ssPath, 'utf8').replace(/\r\n/g, '\n');

// Check import of Pause
if (!ss.includes('Pause,')) {
  ss = ss.replace("Search as SearchIcon, Play,", "Search as SearchIcon, Play, Pause,");
}

// In useAudioPlayer:
ss = ss.replace(
  "const { addToQueue } = useAudioPlayer();",
  "const { addToQueue, isLoadingTrack, togglePlayPause } = useAudioPlayer();"
);

// Update Online track button (line 1081)
const oldOnlineBtn = `<button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handlePlayOnlineTrack(track); 
                            }}
                            className="w-8 h-8 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center brutal-btn shrink-0 cursor-pointer"
                            title="Stream Now"
                          >
                            <Play size={13} fill="currentColor" />
                          </button>`;

const newOnlineBtn = `<button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              const isCur = String(currentTrack?.id || currentTrack?._id) === String(track.id || track._id);
                              if (isCur && isPlaying) {
                                togglePlayPause?.();
                              } else {
                                handlePlayOnlineTrack(track);
                              }
                            }}
                            className="w-8 h-8 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center brutal-btn shrink-0 cursor-pointer"
                            title={String(currentTrack?.id || currentTrack?._id) === String(track.id || track._id) && isLoadingTrack ? "Loading..." : "Stream Now"}
                          >
                            {String(currentTrack?.id || currentTrack?._id) === String(track.id || track._id) && isLoadingTrack ? (
                              <Loader2 size={13} className="animate-spin text-[#0b1110]" />
                            ) : String(currentTrack?.id || currentTrack?._id) === String(track.id || track._id) && isPlaying ? (
                              <Pause size={13} fill="currentColor" />
                            ) : (
                              <Play size={13} fill="currentColor" />
                            )}
                          </button>`;

if (ss.includes(oldOnlineBtn)) {
  ss = ss.replace(oldOnlineBtn, newOnlineBtn);
  console.log('SearchScreen.jsx online button updated');
} else {
  console.log('SearchScreen.jsx online button not found');
}

// Update Local track button (line 1015)
const oldLocalBtn = `<button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  onSelectTrack(track, [track]); 
                                }}
                                className="w-8 h-8 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center brutal-btn cursor-pointer"
                                title="Play"
                              >
                                <Play size={13} fill="currentColor" />
                              </button>`;

const newLocalBtn = `<button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  const isCur = String(currentTrack?.id || currentTrack?._id) === String(track.id || track._id);
                                  if (isCur && isPlaying) {
                                    togglePlayPause?.();
                                  } else {
                                    onSelectTrack(track, [track]);
                                  }
                                }}
                                className="w-8 h-8 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center brutal-btn cursor-pointer"
                                title={String(currentTrack?.id || currentTrack?._id) === String(track.id || track._id) && isLoadingTrack ? "Loading..." : "Play"}
                              >
                                {String(currentTrack?.id || currentTrack?._id) === String(track.id || track._id) && isLoadingTrack ? (
                                  <Loader2 size={13} className="animate-spin text-[#0b1110]" />
                                ) : String(currentTrack?.id || currentTrack?._id) === String(track.id || track._id) && isPlaying ? (
                                  <Pause size={13} fill="currentColor" />
                                ) : (
                                  <Play size={13} fill="currentColor" />
                                )}
                              </button>`;

if (ss.includes(oldLocalBtn)) {
  ss = ss.replace(oldLocalBtn, newLocalBtn);
  console.log('SearchScreen.jsx local button updated');
} else {
  console.log('SearchScreen.jsx local button not found');
}

fs.writeFileSync(ssPath, ss.replace(/\n/g, '\r\n'), 'utf8');
console.log('SearchScreen.jsx written');
