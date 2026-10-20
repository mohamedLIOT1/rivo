/**
 * Comprehensive LRC and ID3 Synchronized Lyrics Parser
 * Parses both standard LRC strings ([mm:ss.xx] lyrics), multi-timestamp LRC,
 * and arrays of lyrics objects into normalized [{ time: number (seconds), text: string }] format.
 */

export function parseLrcLyrics(input) {
  if (!input) return [];

  // 1. If input is already an array of lyric objects
  if (Array.isArray(input)) {
    const valid = input.filter(item => item && typeof item.text === 'string');
    if (valid.length > 0) {
      return valid
        .map((item, idx) => ({
          time: typeof item.time === 'number' && !isNaN(item.time) ? item.time : idx * 5,
          text: String(item.text).trim()
        }))
        .filter(item => item.text.length > 0)
        .sort((a, b) => a.time - b.time);
    }
  }

  // 2. If input is a JSON string of an array
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsedJson = JSON.parse(trimmed);
        if (Array.isArray(parsedJson)) {
          return parseLrcLyrics(parsedJson);
        }
      } catch {}
    }
  }

  if (typeof input !== 'string') return [];

  const text = input.trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const parsed = [];
  let hasTimestamps = false;
  let globalOffset = 0; // in seconds

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for offset header e.g. [offset:+500] or [offset:-200] (in ms)
    const offsetMatch = line.match(/^\[offset:\s*([+-]?\d+)\s*\]$/i);
    if (offsetMatch) {
      const ms = parseInt(offsetMatch[1], 10);
      if (!isNaN(ms)) {
        globalOffset = ms / 1000;
      }
      continue;
    }

    // Skip metadata headers e.g. [ar:Artist], [ti:Title], [al:Album], [by:Creator], [length:03:45]
    if (/^\[(ar|ti|al|by|length|re|ve|hash):.*\]$/i.test(line)) {
      continue;
    }

    const matches = [...line.matchAll(timeRegex)];
    if (matches.length > 0) {
      hasTimestamps = true;
      const cleanLyric = line.replace(timeRegex, '').trim();
      if (!cleanLyric) continue; // Skip empty lyric line with only timestamps

      for (const match of matches) {
        const mins = parseInt(match[1], 10) || 0;
        const secs = parseInt(match[2], 10) || 0;
        let frac = 0;
        if (match[3]) {
          if (match[3].length === 3) {
            frac = parseInt(match[3], 10) / 1000;
          } else if (match[3].length === 2) {
            frac = parseInt(match[3], 10) / 100;
          } else {
            frac = parseInt(match[3], 10) / 10;
          }
        }
        const time = Math.max(0, Math.round(((mins * 60 + secs + frac) + globalOffset) * 100) / 100);
        parsed.push({ time, text: cleanLyric });
      }
    } else if (!hasTimestamps) {
      // Plain line without timestamps
      parsed.push({ text: line });
    }
  }

  if (hasTimestamps) {
    return parsed.sort((a, b) => (a.time || 0) - (b.time || 0));
  } else {
    // Unsynchronized plain text fallback (spaced 5 seconds apart)
    return parsed.map((item, idx) => ({
      time: -1,
      isUnsynced: true,
      text: item.text
    }));
  }
}
