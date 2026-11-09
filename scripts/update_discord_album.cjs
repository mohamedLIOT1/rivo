const fs = require('fs');
const path = require('path');

// 1. Update Form1.cs
const formPath = path.join(__dirname, '..', 'desktop-app', 'Form1.cs');
let formCode = fs.readFileSync(formPath, 'utf8');
const formNorm = formCode.replace(/\r\n/g, '\n');

const formOld = `                if (string.IsNullOrWhiteSpace(album) || album.Trim().Equals("YouTube", StringComparison.OrdinalIgnoreCase) || album.Trim().Equals("Single", StringComparison.OrdinalIgnoreCase))
                {
                    album = "Rivo Music";
                }
                string artwork = root.GetProperty("artwork").GetString() ?? "";
                double curTime = root.GetProperty("currentTime").GetDouble();
                double duration = root.GetProperty("duration").GetDouble();

                DateTime start = DateTime.UtcNow.AddSeconds(-curTime);
                DateTime? end = duration > 0 ? DateTime.UtcNow.AddSeconds(duration - curTime) : null;

                string coverUrl = artwork.StartsWith("http") ? artwork : "https://rivo-m.duckdns.org/discord-badge.png";

                _discord.SetPresence(new RichPresence()
                {
                    Type = ActivityType.Listening,
                    Details = title,
                    State = $"by {artist}",
                    Timestamps = new Timestamps()
                    {
                        Start = start,
                        End = end
                    },
                    Assets = new Assets()
                    {
                        LargeImageKey = coverUrl,
                        LargeImageText = album,
                        SmallImageKey = "https://rivo-m.duckdns.org/discord-badge.png",
                        SmallImageText = "Rivo Hi-Fi"
                    },`;

const formNew = `                bool isRealAlbum = !string.IsNullOrWhiteSpace(album) &&
                    !album.Trim().Equals("YouTube", StringComparison.OrdinalIgnoreCase) &&
                    !album.Trim().Equals("Single", StringComparison.OrdinalIgnoreCase) &&
                    !album.Trim().Equals("Rivo", StringComparison.OrdinalIgnoreCase) &&
                    !album.Trim().Equals("Rivo Music", StringComparison.OrdinalIgnoreCase) &&
                    !album.Trim().Equals("None", StringComparison.OrdinalIgnoreCase) &&
                    !album.Trim().Equals("Unknown", StringComparison.OrdinalIgnoreCase) &&
                    !album.Trim().Equals(title.Trim(), StringComparison.OrdinalIgnoreCase);

                string artwork = root.GetProperty("artwork").GetString() ?? "";
                double curTime = root.GetProperty("currentTime").GetDouble();
                double duration = root.GetProperty("duration").GetDouble();

                DateTime start = DateTime.UtcNow.AddSeconds(-curTime);
                DateTime? end = duration > 0 ? DateTime.UtcNow.AddSeconds(duration - curTime) : null;

                string coverUrl = artwork.StartsWith("http") ? artwork : "https://rivo-m.duckdns.org/discord-badge.png";

                var presenceAssets = new Assets()
                {
                    LargeImageKey = coverUrl,
                    SmallImageKey = "https://rivo-m.duckdns.org/discord-badge.png",
                    SmallImageText = "Rivo Hi-Fi"
                };
                if (isRealAlbum)
                {
                    presenceAssets.LargeImageText = album.Trim();
                }

                _discord.SetPresence(new RichPresence()
                {
                    Type = ActivityType.Listening,
                    Details = title,
                    State = $"by {artist}",
                    Timestamps = new Timestamps()
                    {
                        Start = start,
                        End = end
                    },
                    Assets = presenceAssets,`;

if (formNorm.includes(formOld.replace(/\r\n/g, '\n'))) {
  fs.writeFileSync(formPath, formNorm.replace(formOld.replace(/\r\n/g, '\n'), formNew.replace(/\r\n/g, '\n')).replace(/\n/g, '\r\n'), 'utf8');
  console.log('Form1.cs updated successfully');
} else {
  console.log('Form1.cs pattern not found or already updated');
}

// 2. Update server/discordActivity.js
const discordPath = path.join(__dirname, '..', 'server', 'discordActivity.js');
let discordCode = fs.readFileSync(discordPath, 'utf8');
const discordNorm = discordCode.replace(/\r\n/g, '\n');

const discOld = `        const cleanAlbum = (track.album && !/^(youtube|single|none|unknown)$/i.test(track.album.trim())) ? track.album : (track.title || 'Rivo Music');
        r.setAssetsLargeImage(assetKey).setAssetsLargeText(cleanAlbum);`;

const discNew = `        const isRealAlbum = track.album && 
          !/^(youtube|single|none|unknown|rivo|rivo music)$/i.test(track.album.trim()) &&
          track.album.trim().toLowerCase() !== (track.title || '').trim().toLowerCase();

        r.setAssetsLargeImage(assetKey);
        if (isRealAlbum) {
          r.setAssetsLargeText(track.album.trim());
        }`;

if (discordNorm.includes(discOld.replace(/\r\n/g, '\n'))) {
  fs.writeFileSync(discordPath, discordNorm.replace(discOld.replace(/\r\n/g, '\n'), discNew.replace(/\r\n/g, '\n')).replace(/\n/g, '\r\n'), 'utf8');
  console.log('discordActivity.js updated successfully');
} else {
  console.log('discordActivity.js pattern not found or already updated');
}
