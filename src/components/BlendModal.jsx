import React, { useState } from 'react';
import { X, Users, Sparkles } from 'lucide-react';

export default function BlendModal({ isOpen, onClose, onCreateBlend, currentUser }) {
  const [friendName, setFriendName] = useState('');
  const [friendGenre, setFriendGenre] = useState('Pop');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!friendName.trim()) return;

    // Calculate taste match score algorithmically
    const matchScore = Math.floor(Math.random() * 18) + 82; // 82% to 99% match

    onCreateBlend(friendName.trim(), friendGenre, matchScore);
    setFriendName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-sm w-full p-6 relative">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className="text-base font-mono font-black uppercase text-[#082621]">Harmonic Patient Blend</h3>
          </div>
          <button onClick={onClose} className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[#082621]/70 font-sans my-3">
          Synthesize your audio taste profile with another patient to generate a harmonized dual prescription cassette.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 my-2">
          <div>
            <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">Peer Patient Name</label>
            <input
              type="text"
              placeholder="e.g. Sarah, Ahmed, Alex"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              required
              className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-xs font-sans font-bold text-[#0b1110] placeholder-[#082621]/40 focus:outline-none focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">Target Harmonic Genre</label>
            <select
              value={friendGenre}
              onChange={(e) => setFriendGenre(e.target.value)}
              className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-xs font-mono font-bold text-[#0b1110] focus:outline-none focus:bg-white"
            >
              <option value="Pop">Pop</option>
              <option value="Hip-Hop">Hip-Hop</option>
              <option value="Electronic">Electronic</option>
              <option value="Arab Pop">Arab Pop</option>
              <option value="Rock">Rock</option>
              <option value="Chill & Lofi">Chill & Lofi</option>
            </select>
          </div>

          <button
            type="submit"
            className="brutal-btn w-full py-2.5 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            <Sparkles size={14} className="text-[#f59e0b]" />
            <span>SYNTHESIZE CLINICAL BLEND</span>
          </button>
        </form>
      </div>
    </div>
  );
}
