/**
 * Robust title and artist similarity scoring for track matching.
 * Uses Dice token overlap, penalizes full concerts/compilations when searching a single track,
 * and handles Arabic/English normalization cleanly.
 */

export function calculateTitleSimilarity(targetTitle = '', candTitle = '', targetArtist = '') {
  const t = String(targetTitle || '').toLowerCase().replace(/[/\\?%*:|"<>_()\-]/g, ' ').replace(/\s+/g, ' ').trim();
  const c = String(candTitle || '').toLowerCase().replace(/[/\\?%*:|"<>_()\-]/g, ' ').replace(/\s+/g, ' ').trim();
  const a = String(targetArtist || '').toLowerCase().replace(/[/\\?%*:|"<>_()\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || !c) return 0;
  if (c === t) return 1.0;

  const tTokens = t.split(/\s+/).filter(w => w.length > 1);
  const cTokens = c.split(/\s+/).filter(w => w.length > 1);
  if (tTokens.length === 0 || cTokens.length === 0) return 0;

  let matched = 0;
  for (const tok of tTokens) {
    if (cTokens.includes(tok) || c.includes(tok)) matched++;
  }
  const tokenRecall = matched / tTokens.length;
  const tokenPrecision = matched / cTokens.length;
  let score = 2 * (tokenRecall * tokenPrecision) / (tokenRecall + tokenPrecision || 1);

  // Severe penalty for compilations, medleys, or full concerts when target is a single track
  const isMedleyOrCompilation = (
    c.includes('كاملة') || c.includes('حفلة كاملة') || c.includes('ألبوم كامل') ||
    c.includes('full album') || c.includes('medley') || c.includes('ميدلي') ||
    c.includes('ساعتين') || c.includes('كوكتيل') || c.includes('تجميعة')
  ) && !t.includes('كامل') && !t.includes('حفلة') && !t.includes('ميدلي') && !t.includes('album');

  if (isMedleyOrCompilation) {
    score = Math.max(0, score - 0.7);
  }

  if (a && (c.includes(a) || cTokens.includes(a))) {
    score = Math.min(1.0, score + 0.15);
  }
  return score;
}
