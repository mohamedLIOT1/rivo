const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../src/components/MiniPlayer.jsx');
let content = fs.readFileSync(p, 'utf8');

// Update desktop play button
const desktopTarget = `{isPlaying ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" className="ml-0.5" />
                )}`;
const desktopReplacement = `{isLoadingTrack ? (
                  <Loader2 size={18} className="animate-spin text-[#0b1110]" />
                ) : isPlaying ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" className="ml-0.5" />
                )}`;

// Update mobile play button
const mobileTarget = `{isPlaying 
                ? <Pause size={17} fill="currentColor" /> 
                : <Play size={17} fill="currentColor" className="ml-0.5" />
              }`;
const mobileReplacement = `{isLoadingTrack ? (
                <Loader2 size={17} className="animate-spin text-[#0b1110]" />
              ) : isPlaying ? (
                <Pause size={17} fill="currentColor" />
              ) : (
                <Play size={17} fill="currentColor" className="ml-0.5" />
              )}`;

content = content.replace(desktopTarget.replace(/\r\n/g, '\n'), desktopReplacement.replace(/\r\n/g, '\n'));
content = content.replace(desktopTarget.replace(/\n/g, '\r\n'), desktopReplacement.replace(/\n/g, '\r\n'));
content = content.replace(mobileTarget.replace(/\r\n/g, '\n'), mobileReplacement.replace(/\r\n/g, '\n'));
content = content.replace(mobileTarget.replace(/\n/g, '\r\n'), mobileReplacement.replace(/\n/g, '\r\n'));

fs.writeFileSync(p, content, 'utf8');
console.log('MiniPlayer spinner updated successfully!');
