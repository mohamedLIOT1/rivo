/**
 * Rivo Podcasts Engine Router
 * Dedicated taxonomy, shows catalog, episodes & streaming API.
 * Strictly modularized (< 400 lines) per AGENTS.md.
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const PODCAST_CATEGORIES = [
  { id: 'all', label: 'الكل', labelEn: 'All', icon: '🌟' },
  { id: 'culture', label: 'ثقافة وتطوير ذات', labelEn: 'Culture & Mindset', icon: '💡' },
  { id: 'science', label: 'علمي وتكنولوجي', labelEn: 'Science & Tech', icon: '🔬' },
  { id: 'faith', label: 'ديني وتزكية', labelEn: 'Faith & Soul', icon: '🕌' },
  { id: 'business', label: 'بزنس وريادة أعمال', labelEn: 'Business & Finance', icon: '💼' },
  { id: 'stories', label: 'قصص وتاريخ', labelEn: 'Stories & History', icon: '🕵️‍♂️' },
  { id: 'sports', label: 'رياضة وكورة', labelEn: 'Sports', icon: '⚽' }
];

const CURATED_PODCAST_SHOWS = [
  {
    id: 'fnjan',
    title: 'بودكاست فنجان',
    host: 'عبدالرحمن أبو مالح',
    category: 'culture',
    cover: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600',
    description: 'حوارات معمقة في السياسة والمجتمع والثقافة وريادة الأعمال، مع ضيوف من مختلف أنحاء العالم العربي.',
    episodesCount: 8,
    episodes: [
      {
        id: 'fnjan-1',
        title: 'كيف تنجح في بناء مستقبلك المهني في العصر الرقمي',
        showId: 'fnjan',
        showTitle: 'بودكاست فنجان',
        host: 'عبدالرحمن أبو مالح',
        duration: 3420,
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ambient-piano-amp-strings-10711.mp3',
        cover: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600',
        publishedAt: '2026-02-10'
      },
      {
        id: 'fnjan-2',
        title: 'أسرار الذكاء الاصطناعي ومستقبل الوظائف',
        showId: 'fnjan',
        showTitle: 'بودكاست فنجان',
        host: 'عبدالرحمن أبو مالح',
        duration: 4180,
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=cinematic-time-lapse-115672.mp3',
        cover: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600',
        publishedAt: '2026-02-03'
      }
    ]
  },
  {
    id: 'waai',
    title: 'بودكاست وعي',
    host: 'أحمد عامر وشريف علي وحازم الصديق',
    category: 'faith',
    cover: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=600',
    description: 'جلسات شبابية صريحة تناقش قضايا الوعي النفسي، الديني، والاجتماعي بأسلوب معاصر وعملي.',
    episodesCount: 6,
    episodes: [
      {
        id: 'waai-1',
        title: 'التعافي من التعلق المرضي وضبط المشاعر',
        showId: 'waai',
        showTitle: 'بودكاست وعي',
        host: 'أحمد عامر وشريف علي',
        duration: 2850,
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=soft-piano-meditation-9686.mp3',
        cover: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=600',
        publishedAt: '2026-01-28'
      },
      {
        id: 'waai-2',
        title: 'السكينة النفسية والتعامل مع ضغوط الحياة اليومية',
        showId: 'waai',
        showTitle: 'بودكاست وعي',
        host: 'أحمد عامر وشريف علي',
        duration: 3120,
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ambient-piano-amp-strings-10711.mp3',
        cover: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=600',
        publishedAt: '2026-01-15'
      }
    ]
  },
  {
    id: 'dopamine',
    title: 'دوباميكافين',
    host: 'ناصر العقيل',
    category: 'science',
    cover: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600',
    description: 'رحلة مشوقة في سيكولوجيا العقل البشري، الكيمياء العصبية، والكتب الأكثر تأثيراً في العالم.',
    episodesCount: 7,
    episodes: [
      {
        id: 'dopamine-1',
        title: 'كيف تتخلص من إدمان المشتتات وتستعيد تركيزك الخارق',
        showId: 'dopamine',
        showTitle: 'دوباميكافين',
        host: 'ناصر العقيل',
        duration: 2410,
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=cinematic-time-lapse-115672.mp3',
        cover: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600',
        publishedAt: '2026-02-05'
      }
    ]
  },
  {
    id: 'droos',
    title: 'دروس أونلاين بودكاست',
    host: 'أحمد أبو زيد',
    category: 'business',
    cover: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600',
    description: 'دردشة عفوية مع رواد أعمال، صناع محتوى، وخبراء تقنيين حول أسرار العمل الحر وتطوير الذات.',
    episodesCount: 5,
    episodes: [
      {
        id: 'droos-1',
        title: 'من الصفر إلى المليون: أسرار البيزنس وبناء البراند الشخصي',
        showId: 'droos',
        showTitle: 'دروس أونلاين بودكاست',
        host: 'أحمد أبو زيد',
        duration: 3600,
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ambient-piano-amp-strings-10711.mp3',
        cover: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600',
        publishedAt: '2026-02-01'
      }
    ]
  },
  {
    id: 'sandbad',
    title: 'بودكاست سندباد',
    host: 'محمد قاسم',
    category: 'stories',
    cover: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=600',
    description: 'روايات تاريخية وقصص حقيقية من أعماق الحضارات القديمة والرحلات الاستكشافية الكبرى.',
    episodesCount: 4,
    episodes: [
      {
        id: 'sandbad-1',
        title: 'طريق الحرير: كيف غيرت التجارة والبهارات خريطة العالم',
        showId: 'sandbad',
        showTitle: 'بودكاست سندباد',
        host: 'محمد قاسم',
        duration: 2980,
        audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=soft-piano-meditation-9686.mp3',
        cover: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=600',
        publishedAt: '2026-01-20'
      }
    ]
  }
];

// 1. Get Categories
router.get('/categories', (req, res) => {
  res.json({ success: true, categories: PODCAST_CATEGORIES });
});

// 2. Get Shows (with optional category filter)
router.get('/shows', async (req, res) => {
  try {
    const { category, q } = req.query;
    let shows = [...CURATED_PODCAST_SHOWS];

    if (category && category !== 'all') {
      shows = shows.filter(s => s.category === category);
    }

    if (q && q.trim()) {
      const query = q.trim().toLowerCase();
      shows = shows.filter(s => 
        s.title.toLowerCase().includes(query) || 
        s.host.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
      );
    }

    res.json({ success: true, shows, count: shows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Single Show & Episodes
router.get('/shows/:id', (req, res) => {
  const show = CURATED_PODCAST_SHOWS.find(s => s.id === req.params.id);
  if (!show) {
    return res.status(404).json({ error: 'Podcast show not found' });
  }
  res.json({ success: true, show });
});

// 4. Get All Episodes (flattened with pagination & category filtering)
router.get('/episodes', (req, res) => {
  try {
    const { category, limit = 20, page = 1 } = req.query;
    let allEpisodes = CURATED_PODCAST_SHOWS.flatMap(s => s.episodes.map(ep => ({
      ...ep,
      category: s.category
    })));

    if (category && category !== 'all') {
      allEpisodes = allEpisodes.filter(e => e.category === category);
    }

    const total = allEpisodes.length;
    const start = (Number(page) - 1) * Number(limit);
    const paginated = allEpisodes.slice(start, start + Number(limit));

    res.json({
      success: true,
      episodes: paginated,
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Featured Episodes for Home & Spotlight
router.get('/featured', (req, res) => {
  const featured = CURATED_PODCAST_SHOWS.map(s => s.episodes[0]).filter(Boolean);
  res.json({ success: true, featured });
});

module.exports = router;
