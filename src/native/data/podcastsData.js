/**
 * Official Curated Podcast Shows & Categories for Rivo (Native Mobile)
 * High-definition authentic audio streams & official creator artwork.
 */

import { PODCAST_CATEGORIES } from './podcasts/categories.js';
import { FAMOUS_PODCAST_SHOWS } from './podcasts/showsCatalog.js';

export { PODCAST_CATEGORIES, FAMOUS_PODCAST_SHOWS };

export const PODCAST_SHOWS = FAMOUS_PODCAST_SHOWS;
export const ALL_PODCAST_EPISODES = FAMOUS_PODCAST_SHOWS.flatMap(s => s.episodes || []);
export const ALL_DEFAULT_PODCAST_EPISODES = ALL_PODCAST_EPISODES;
export const PODCAST_SHOWS_EPISODES = ALL_PODCAST_EPISODES;
export const FEATURED_PODCAST_EPISODES = ALL_PODCAST_EPISODES.slice(0, 5);
