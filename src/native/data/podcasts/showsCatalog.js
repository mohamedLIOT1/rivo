/**
 * Master Podcast Shows Catalog for Rivo (Native Mobile)
 * Combines curated authentic shows across culture, science, faith, business, and sports.
 */

import { CULTURE_PODCAST_SHOWS } from './shows/cultureShows.js';
import { KNOWLEDGE_PODCAST_SHOWS } from './shows/knowledgeShows.js';

export const FAMOUS_PODCAST_SHOWS = [
  ...CULTURE_PODCAST_SHOWS,
  ...KNOWLEDGE_PODCAST_SHOWS
];
