const fs = require('fs');
const babel = require('@babel/core');

const files = [
  'App.js',
  'src/native/components/settings/LockscreenSettingCard.js',
  'src/native/services/mediaControls.js',
  'src/native/screens/HomeScreen.js',
  'src/native/screens/SearchScreen.js',
  'src/native/screens/LibraryScreen.js',
  'src/native/screens/ProfileScreen.js',
  'src/native/screens/OfflineScreen.js',
  'src/native/screens/StatsScreen.js',
  'src/native/components/FullPlayerModal.js',
  'src/native/components/ChatModal.js',
  'src/native/components/ChatMessageItem.js',
  'src/native/components/MessageReactionsNative.js',
  'src/native/components/ChatEmojiPickerModal.js',
  'src/native/components/AlbumDetailModal.js',
  'src/native/components/ArtistDetailModal.js',
  'src/native/components/artist/useArtistDetailData.js',
  'src/native/components/MiniMixerModal.js',
  'src/native/components/SettingsModal.js',
  'src/native/components/PlaylistPickerModal.js',
  'src/native/components/SleepTimerModal.js',
  'src/native/components/FriendActivityModal.js',
  'src/native/components/FriendActivityCard.js',
  'src/components/ListeningActivityPanel.jsx',
  'src/components/activity/ActivityListItem.jsx',
  'src/screens/StatsScreen.jsx',
  'src/screens/LibraryScreen.jsx',
  'src/screens/ProfileScreen.jsx',
  'src/components/library/FollowedArtistsShelf.jsx',
  'src/components/library/LibraryPlaylistsGrid.jsx',
  'src/components/playlist/PlaylistCoverCollage.jsx',
  'src/components/profile/ProfilePlaylists.jsx',
  'src/components/profile/SocialModal.jsx',
  'src/components/profile/ProfileHeroCard.jsx',
  'src/components/profile/ViewingUserProfile.jsx',
  'src/native/components/playlist/PlaylistCoverCollage.js'
];

let errors = 0;
for (const rel of files) {
  try {
    const code = fs.readFileSync(rel, 'utf8');
    babel.parseSync(code, {
      filename: rel,
      presets: ['@babel/preset-react'],
      configFile: false,
      babelrc: false
    });
    console.log(`[PASS] ${rel} (${code.length} bytes)`);
  } catch (err) {
    console.error(`[FAIL] ${rel}:`, err.message);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\nFound ${errors} syntax errors.`);
  process.exit(1);
} else {
  console.log(`\nAll ${files.length} files parsed with ZERO syntax errors.`);
}
