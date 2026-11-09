const fs = require('fs');
const path = require('path');

const psPath = path.join(__dirname, '..', 'src', 'screens', 'PlaylistScreen.jsx');
let ps = fs.readFileSync(psPath, 'utf8').replace(/\r\n/g, '\n');

// Update useAudioPlayer destructuring
ps = ps.replace(
  "const { currentTrack, isMixMode,",
  "const { currentTrack, isPlaying, isLoadingTrack, togglePlayPause, isMixMode,"
);

// Inject helper before return or before action buttons
const oldPlBtn = `          <button
            disabled={filteredPlaylistTracks.length === 0}
            onClick={() => filteredPlaylistTracks.length > 0 && handlePlayPlaylistTrack(filteredPlaylistTracks[0])}
            className={\`brutal-btn w-10 h-10 sm:w-12 sm:h-12 brutal-border-thick brutal-shadow flex items-center justify-center transition-all shrink-0 \${
              filteredPlaylistTracks.length > 0
                ? 'bg-[#10b981] hover:bg-emerald-400 text-[#0b1110] cursor-pointer'
                : 'bg-[#ded2bb] text-[#0b1110]/40 cursor-not-allowed'
            }\`}
            title="Play playlist"
          >
            <Play size={18} fill="currentColor" className="ml-0.5 text-[#0b1110] sm:w-5 sm:h-5" />
          </button>`;

const newPlBtn = `          {(() => {
            const isCurPlPlaying = currentTrack && filteredPlaylistTracks.some(t => String(t.id || t._id) === String(currentTrack.id || currentTrack._id));
            return (
              <button
                disabled={filteredPlaylistTracks.length === 0}
                onClick={() => {
                  if (filteredPlaylistTracks.length === 0) return;
                  if (isCurPlPlaying) {
                    togglePlayPause?.();
                  } else {
                    handlePlayPlaylistTrack(filteredPlaylistTracks[0]);
                  }
                }}
                className={\`brutal-btn w-10 h-10 sm:w-12 sm:h-12 brutal-border-thick brutal-shadow flex items-center justify-center transition-all shrink-0 \${
                  filteredPlaylistTracks.length > 0
                    ? 'bg-[#10b981] hover:bg-emerald-400 text-[#0b1110] cursor-pointer'
                    : 'bg-[#ded2bb] text-[#0b1110]/40 cursor-not-allowed'
                }\`}
                title={isCurPlPlaying && isLoadingTrack ? "Loading..." : isCurPlPlaying && isPlaying ? "Pause playlist" : "Play playlist"}
              >
                {isCurPlPlaying && isLoadingTrack ? (
                  <Loader2 size={18} className="animate-spin text-[#0b1110]" />
                ) : isCurPlPlaying && isPlaying ? (
                  <Pause size={18} fill="currentColor" className="text-[#0b1110] sm:w-5 sm:h-5" />
                ) : (
                  <Play size={18} fill="currentColor" className="ml-0.5 text-[#0b1110] sm:w-5 sm:h-5" />
                )}
              </button>
            );
          })()}`;

if (ps.includes(oldPlBtn)) {
  ps = ps.replace(oldPlBtn, newPlBtn);
  fs.writeFileSync(psPath, ps.replace(/\n/g, '\r\n'), 'utf8');
  console.log('PlaylistScreen.jsx updated with spinner and pause');
} else {
  console.log('PlaylistScreen.jsx play button pattern not found');
}
