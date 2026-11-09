const fs = require('fs');
const path = require('path');

// 1. Update src/utils/tasteAlgorithm.js
const webTastePath = path.join(__dirname, '..', 'src', 'utils', 'tasteAlgorithm.js');
let webCode = fs.readFileSync(webTastePath, 'utf8').replace(/\r\n/g, '\n');

const webOldScoring = `    // 1. Real Audio Listening History Match (+up to 85 pts)
    const realStat = trackStatsMap[trackKey] || trackStatsMap[tId] || trackStatsMap[String(track._id)] || trackStatsMap[String(track.id)];
    if (realStat) {
      const realPlays = Number(realStat.plays) || 0;
      const realSecs = Number(realStat.seconds) || 0;
      if (realPlays > 0 || realSecs >= 20) {
        score += 45;
        score += Math.min(25, Math.log2(realPlays + 1) * 8);
        score += Math.min(15, Math.floor(realSecs / 120) * 3);
      }
    }

    // 2. Real Listened Artist Affinity (+up to 40 pts)
    const artistListeningWeight = listenedArtistWeights.get(primaryArt) || 0;
    if (artistListeningWeight > 0) {
      score += Math.min(40, 15 + Math.log10(artistListeningWeight + 1) * 10);
    }

    // 3. Recent Playback Recency (+15 pts)
    if (recentHistorySet.has(trackKey) || recentHistorySet.has(tId)) {
      score += 15;
    }

    // 4. Followed Artist match (+45 pts)
    for (const followed of followedSet) {
      if (followed && (primaryArt.includes(followed) || followed.includes(primaryArt))) {
        score += 45;
        break;
      }
    }

    // 5. Liked song match (+40 pts)
    if (likedSet.has(tId)) {
      score += 40;
    }

    // 6. Artist taste similarity from liked songs (+30 pts)
    if (likedArtistSet.has(primaryArt)) {
      score += 30;
    }

    // 7. Seed Artist context bonus (balanced to prevent flooding)
    if (seedArtist && (primaryArt === seedArtist || primaryArt.includes(seedArtist) || seedArtist.includes(primaryArt))) {
      score += 25;
    }

    // 8. Similar-Vibe Genre Clustering Synergy (+35 pts)
    if (preferredGenreSet.has(tGenre)) {
      score += 35;
    }

    // 9. Time-of-day mood keywords match (+25 pts)
    for (const kw of mood.keywords) {
      if (tText.includes(kw.toLowerCase())) {
        score += 25;
        break;
      }
    }

    // 10. Popularity / play count bonus (up to +15 pts)
    const plays = Number(track.plays || track.playCount || 0);
    score += Math.min(15, Math.log10(plays + 1) * 4);

    // 11. Dynamic micro-jitter for organic variety (+0 to 10 pts)
    score += Math.random() * 10;`;

const webNewScoring = `    // 1. Real Audio Listening History Match (balanced +up to 20 pts)
    const realStat = trackStatsMap[trackKey] || trackStatsMap[tId] || trackStatsMap[String(track._id)] || trackStatsMap[String(track.id)];
    if (realStat) {
      const realPlays = Number(realStat.plays) || 0;
      const realSecs = Number(realStat.seconds) || 0;
      if (realPlays > 0 || realSecs >= 20) {
        score += 12;
        score += Math.min(8, Math.log2(realPlays + 1) * 2.5);
      }
    }

    // 2. Real Listened Artist Affinity (+up to 15 pts)
    const artistListeningWeight = listenedArtistWeights.get(primaryArt) || 0;
    if (artistListeningWeight > 0) {
      score += Math.min(15, 5 + Math.log10(artistListeningWeight + 1) * 4);
    }

    // 3. Recent Playback Recency (+10 pts)
    if (recentHistorySet.has(trackKey) || recentHistorySet.has(tId)) {
      score += 10;
    }

    // 4. Followed Artist match (+25 pts)
    for (const followed of followedSet) {
      if (followed && (primaryArt.includes(followed) || followed.includes(primaryArt))) {
        score += 25;
        break;
      }
    }

    // 5. Liked song match (+25 pts)
    if (likedSet.has(tId)) {
      score += 25;
    }

    // 6. Artist taste similarity from liked songs (+20 pts)
    if (likedArtistSet.has(primaryArt)) {
      score += 20;
    }

    // 7. Seed Artist context bonus (PRIMARY BOOST for contextual continuity: +55 pts)
    if (seedArtist && (primaryArt === seedArtist || primaryArt.includes(seedArtist) || seedArtist.includes(primaryArt))) {
      score += 55;
    }

    // 8. Similar-Vibe Genre Clustering Synergy (+50 pts)
    if (preferredGenreSet.has(tGenre)) {
      score += 50;
    }

    // 9. Time-of-day mood keywords match (+20 pts)
    for (const kw of mood.keywords) {
      if (tText.includes(kw.toLowerCase())) {
        score += 20;
        break;
      }
    }

    // 10. Popularity / play count bonus (up to +15 pts)
    const plays = Number(track.plays || track.playCount || 0);
    score += Math.min(15, Math.log10(plays + 1) * 4);

    // 11. Dynamic exploratory jitter (+0 to 45 pts) to ensure fresh organic diversity every playback
    score += Math.random() * 45;`;

const webOldSelection = `  // Step 4: STRICT Artist Diversity Capping & Deduplication
  // Strictly enforces max 2 songs per artist in the auto-generated queue to eliminate artist monopolization
  const selected = [];
  const artistCounts = new Map();
  const selectedKeys = new Set();

  // If there is a seed track, count its artist as 1 against the cap
  if (seedArtist) {
    artistCounts.set(seedArtist, 1);
  }

  for (const item of scored) {
    if (selected.length >= limit) break;
    if (selectedKeys.has(item.dedupeKey)) continue;

    const currentArtistCount = artistCounts.get(item.primaryArt) || 0;
    if (currentArtistCount < maxCap) {
      selected.push(item);
      selectedKeys.add(item.dedupeKey);
      artistCounts.set(item.primaryArt, currentArtistCount + 1);
    }
  }

  // If we haven't reached the limit, allow a second pass up to maxCap + 1 (never exceeding 3 per artist)
  if (selected.length < limit) {
    for (const item of scored) {
      if (selected.length >= limit) break;
      if (selectedKeys.has(item.dedupeKey)) continue;

      const currentArtistCount = artistCounts.get(item.primaryArt) || 0;
      if (currentArtistCount < Math.min(maxCap + 1, 3)) {
        selected.push(item);
        selectedKeys.add(item.dedupeKey);
        artistCounts.set(item.primaryArt, currentArtistCount + 1);
      }
    }
  }

  // Return unique tracks with authentic deduced genre
  return selected.map(item => ({
    ...item.track,
    genre: item.tGenre || detectTrackGenre(item.track),
  }));`;

const webNewSelection = `  // Step 4: STRICT Artist Diversity Capping, Dynamic Shuffling & Randomization
  const candidatePool = [];
  const artistCounts = new Map();
  const selectedKeys = new Set();

  if (seedArtist) {
    artistCounts.set(seedArtist, 1);
  }

  for (const item of scored) {
    if (candidatePool.length >= limit * 2) break;
    if (selectedKeys.has(item.dedupeKey)) continue;

    const currentArtistCount = artistCounts.get(item.primaryArt) || 0;
    if (currentArtistCount < maxCap) {
      candidatePool.push(item);
      selectedKeys.add(item.dedupeKey);
      artistCounts.set(item.primaryArt, currentArtistCount + 1);
    }
  }

  if (candidatePool.length < limit) {
    for (const item of scored) {
      if (candidatePool.length >= limit) break;
      if (selectedKeys.has(item.dedupeKey)) continue;

      const currentArtistCount = artistCounts.get(item.primaryArt) || 0;
      if (currentArtistCount < Math.min(maxCap + 1, 3)) {
        candidatePool.push(item);
        selectedKeys.add(item.dedupeKey);
        artistCounts.set(item.primaryArt, currentArtistCount + 1);
      }
    }
  }

  // Keep top 1 direct contextual match, Fisher-Yates shuffle the rest for non-static variety
  let selected = [];
  if (candidatePool.length > 0) {
    const first = candidatePool[0];
    const rest = candidatePool.slice(1);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    selected = [first, ...rest].slice(0, limit);
  }

  return selected.map(item => ({
    ...item.track,
    genre: item.tGenre || detectTrackGenre(item.track),
  }));`;

if (webCode.includes(webOldScoring)) {
  webCode = webCode.replace(webOldScoring, webNewScoring);
  console.log('web taste scoring updated');
} else {
  console.log('web taste scoring not matched');
}

if (webCode.includes(webOldSelection)) {
  webCode = webCode.replace(webOldSelection, webNewSelection);
  console.log('web taste selection updated');
} else {
  console.log('web taste selection not matched');
}

fs.writeFileSync(webTastePath, webCode.replace(/\n/g, '\r\n'), 'utf8');

// 2. Update src/native/utils/tasteAlgorithm.js
const natTastePath = path.join(__dirname, '..', 'src', 'native', 'utils', 'tasteAlgorithm.js');
let natCode = fs.readFileSync(natTastePath, 'utf8').replace(/\r\n/g, '\n');

const natOldScoring = `    // 1. User Top Track & Artist Affinity (profile listening data)
    if (userTopTrackTitle && (normTitle.includes(userTopTrackTitle) || userTopTrackTitle.includes(normTitle))) {
      score += 55;
    }
    if (userTopTrackArtist && (primaryArt.includes(userTopTrackArtist) || userTopTrackArtist.includes(primaryArt))) {
      score += 40;
    }

    // 2. Followed Artist match (+45 pts)
    for (const followed of followedSet) {
      if (followed && (primaryArt.includes(followed) || followed.includes(primaryArt))) {
        score += 45;
        break;
      }
    }

    // 3. Liked song match (+40 pts)
    if (likedSet.has(tId)) {
      score += 40;
    }

    // 4. Artist taste similarity from liked songs (+30 pts)
    if (likedArtistSet.has(primaryArt)) {
      score += 30;
    }

    // 5. Seed Artist context bonus (balanced to prevent monopolization)
    if (seedArtist && (primaryArt === seedArtist || primaryArt.includes(seedArtist) || seedArtist.includes(primaryArt))) {
      score += 25;
    }

    // 6. Similar-Vibe Genre Clustering Synergy (+35 pts)
    if (preferredGenreSet.has(tGenre)) {
      score += 35;
    }

    // 7. Time-of-day mood keywords match (+25 pts)
    for (const kw of mood.keywords) {
      if (tText.includes(kw.toLowerCase())) {
        score += 25;
        break;
      }
    }

    // 8. Popularity / play count bonus (up to +15 pts)
    const plays = Number(track.plays || track.playCount || 0);
    score += Math.min(15, Math.log10(plays + 1) * 4);

    // 9. Dynamic micro-jitter for organic variety (+0 to 10 pts)
    score += Math.random() * 10;`;

const natNewScoring = `    // 1. User Top Track & Artist Affinity (profile listening data: +up to 20 pts)
    if (userTopTrackTitle && (normTitle.includes(userTopTrackTitle) || userTopTrackTitle.includes(normTitle))) {
      score += 15;
    }
    if (userTopTrackArtist && (primaryArt.includes(userTopTrackArtist) || userTopTrackArtist.includes(primaryArt))) {
      score += 12;
    }

    // 2. Followed Artist match (+25 pts)
    for (const followed of followedSet) {
      if (followed && (primaryArt.includes(followed) || followed.includes(primaryArt))) {
        score += 25;
        break;
      }
    }

    // 3. Liked song match (+25 pts)
    if (likedSet.has(tId)) {
      score += 25;
    }

    // 4. Artist taste similarity from liked songs (+20 pts)
    if (likedArtistSet.has(primaryArt)) {
      score += 20;
    }

    // 5. Seed Artist context bonus (PRIMARY BOOST for contextual continuity: +55 pts)
    if (seedArtist && (primaryArt === seedArtist || primaryArt.includes(seedArtist) || seedArtist.includes(primaryArt))) {
      score += 55;
    }

    // 6. Similar-Vibe Genre Clustering Synergy (+50 pts)
    if (preferredGenreSet.has(tGenre)) {
      score += 50;
    }

    // 7. Time-of-day mood keywords match (+20 pts)
    for (const kw of mood.keywords) {
      if (tText.includes(kw.toLowerCase())) {
        score += 20;
        break;
      }
    }

    // 8. Popularity / play count bonus (up to +15 pts)
    const plays = Number(track.plays || track.playCount || 0);
    score += Math.min(15, Math.log10(plays + 1) * 4);

    // 9. Dynamic exploratory jitter (+0 to 45 pts) to ensure fresh organic diversity every playback
    score += Math.random() * 45;`;

if (natCode.includes(natOldScoring)) {
  natCode = natCode.replace(natOldScoring, natNewScoring);
  console.log('native taste scoring updated');
} else {
  console.log('native taste scoring not matched');
}

if (natCode.includes(webOldSelection)) {
  natCode = natCode.replace(webOldSelection, webNewSelection);
  console.log('native taste selection updated');
} else {
  console.log('native taste selection not matched');
}

fs.writeFileSync(natTastePath, natCode.replace(/\n/g, '\r\n'), 'utf8');
console.log('All taste algorithms updated successfully');
