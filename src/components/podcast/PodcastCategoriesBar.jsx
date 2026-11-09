import React from 'react';

export const CATEGORIES_LIST = [
  { id: 'all', label: 'الكل', labelEn: 'All', icon: '🌟' },
  { id: 'religious', label: 'ديني وتزكية', labelEn: 'Faith & Religion', icon: '🕌' },
  { id: 'science', label: 'علمي وتكنولوجي', labelEn: 'Science & Tech', icon: '🔬' },
  { id: 'sports', label: 'رياضي وكروي', labelEn: 'Sports', icon: '⚽' },
  { id: 'stories', label: 'قصص وجرائم وغموض', labelEn: 'Stories & Crime', icon: '🕵️‍♂️' },
  { id: 'business', label: 'بزنس وريادة أعمال', labelEn: 'Business', icon: '💼' },
  { id: 'culture', label: 'ثقافة وتطوير ذات', labelEn: 'Culture & Mindset', icon: '💡' },
];

const PodcastCategoriesBar = React.memo(function PodcastCategoriesBar({
  selectedCategory = 'all',
  onSelectCategory = () => {},
  isDark = true,
  isRTL = true,
  t,
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
      {CATEGORIES_LIST.map((cat) => {
        const isActive = selectedCategory === cat.id;
        const translatedLabel = t ? t(`podcast.categories.${cat.id}`) : null;
        const displayLabel = translatedLabel || (isRTL ? cat.label : cat.labelEn);

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold transition-all brutal-btn whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isActive
                ? 'bg-[#10b981] text-[#041d1a] font-black brutal-border shadow-[0_0_15px_rgba(16,185,129,0.35)] scale-[1.02]'
                : isDark
                  ? 'bg-[#102421]/90 hover:bg-[#15312d] text-emerald-200 border border-emerald-900/60'
                  : 'bg-white hover:bg-[#ede5d3] text-[#0b1110] brutal-border'
            }`}
          >
            <span className="text-sm">{cat.icon}</span>
            <span>{displayLabel}</span>
          </button>
        );
      })}
    </div>
  );
});

export default PodcastCategoriesBar;
