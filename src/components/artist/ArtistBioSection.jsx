import React from 'react';
import { useTranslation } from '../../context/PreferencesContext';

export default function ArtistBioSection({
  bio,
  artistName,
  isDark = true
}) {
  const { t } = useTranslation();
  if (!bio) return null;

  return (
    <div className={`brutal-border-thick brutal-shadow-lg p-6 max-w-3xl rounded-xl transition-colors ${
      isDark ? 'bg-[#082621] text-[#fdfbf7] border-zinc-700' : 'bg-[#082621] text-[#fdfbf7] border-black'
    }`}>
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#26c4b7]/30">
        <h2 className="text-base font-mono font-black uppercase text-[#26c4b7]">
          {t('profile.aboutArtist') || 'ABOUT'}: {artistName}
        </h2>
      </div>
      <p className="text-xs sm:text-sm text-[#ded2bb] leading-relaxed font-sans font-medium whitespace-pre-line">
        {bio}
      </p>
    </div>
  );
}
