export const GENRES = [
  { id: "g-1", name: "Pop (بوب عربي)", color: "#ec4899", icon: "🎵" },
  { id: "g-2", name: "Hip-Hop & Trap", color: "#f97316", icon: "🎤" },
  { id: "g-3", name: "Electronic", color: "#06b6d4", icon: "🎧" },
  { id: "g-4", name: "Tarab (طرب)", color: "#eab308", icon: "🪕" },
  { id: "g-5", name: "Rock", color: "#ef4444", icon: "🎸" },
  { id: "g-6", name: "Chill & Lofi", color: "#a855f7", icon: "☕" },
  { id: "g-7", name: "Workout", color: "#22c55e", icon: "💪" },
  { id: "g-8", name: "Podcasts", color: "#3b82f6", icon: "🎙️" }
];

export const PODCASTS = [
  {
    id: "pod-1",
    title: "فنجان مع عبدالرحمن أبومالح",
    author: "ثمانية / Thmanyah",
    cover: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600",
    episodesCount: 12,
    episodes: [
      {
        id: "ep-1",
        title: "كيف تسيطر على تركيزك في عالم مشتت",
        duration: "45:20",
        date: "2026-03-12",
        audioUrl: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
      },
      {
        id: "ep-2",
        title: "أسرار الإنتاجية والموسيقى العميقة",
        duration: "38:15",
        date: "2026-03-05",
        audioUrl: "https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg",
      }
    ]
  },
  {
    id: "pod-2",
    title: "ساندوتش ورقي",
    author: "أنس بن سليم",
    cover: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=600",
    episodesCount: 8,
    episodes: [
      {
        id: "ep-3",
        title: "خلاصة كتاب: التفكير بسرعة وببطء",
        duration: "24:10",
        date: "2026-02-28",
        audioUrl: "https://actions.google.com/sounds/v1/ambiences/office_room.ogg",
      }
    ]
  }
];
