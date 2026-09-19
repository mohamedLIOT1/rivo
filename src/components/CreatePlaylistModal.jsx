import React, { useState } from 'react';
import { X, Plus, Camera, Globe, Lock } from 'lucide-react';

export default function CreatePlaylistModal({ isOpen, onClose, onCreatePlaylist }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCover(reader.result);
      setCoverPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const defaultCover = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=082621&color=26c4b7&size=512&bold=true&format=svg`;
    onCreatePlaylist(title.trim(), description.trim(), cover || defaultCover, isPublic);
    setTitle('');
    setDescription('');
    setCover('');
    setCoverPreview('');
    setIsPublic(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-md w-full p-6 relative">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className="text-base font-mono font-black uppercase text-[#082621]">Formulate New Cassette</h3>
          </div>
          <button onClick={onClose} className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-4">
          {/* Cover Art Selector */}
          <div className="flex items-center gap-4">
            <label className="w-24 h-24 bg-[#ede5d3] brutal-border border-dashed hover:bg-white flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group shrink-0">
              {coverPreview ? (
                <img src={coverPreview} alt="cover preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-[#082621]">
                  <Camera size={22} />
                  <span className="text-[9px] font-mono font-black uppercase">CASSETTE ART</span>
                </div>
              )}
              <div className="absolute inset-0 bg-[#082621]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={20} className="text-[#26c4b7]" />
              </div>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>

            <div className="flex-1">
              <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">CASSETTE TITLE *</label>
              <input
                type="text"
                placeholder="e.g. Afternoon Sedative Tape"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-xs font-sans font-bold text-[#0b1110] placeholder-[#082621]/40 focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">CLINICAL DESCRIPTION (OPTIONAL)</label>
            <textarea
              placeholder="Therapeutic notes regarding this sound prescription..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-xs font-sans font-medium text-[#0b1110] placeholder-[#082621]/40 focus:outline-none focus:bg-white resize-none"
            />
          </div>

          {/* Privacy Toggle */}
          <div className="p-3 bg-[#ede5d3] brutal-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {isPublic ? <Globe size={18} className="text-[#17a398]" /> : <Lock size={18} className="text-[#f59e0b]" />}
              <div>
                <p className="text-xs font-mono font-bold text-[#082621]">{isPublic ? 'PUBLIC RECORD' : 'CONFIDENTIAL DOSAGE'}</p>
                <p className="text-[10px] text-[#082621]/70">{isPublic ? 'Visible to other dispensary patients' : 'Restricted strictly to personal archive'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className="brutal-btn px-3 py-1 bg-[#fdfbf7] brutal-border text-[10px] font-mono font-black uppercase text-[#082621]"
            >
              {isPublic ? 'PUBLIC' : 'PRIVATE'}
            </button>
          </div>

          <button
            type="submit"
            className="brutal-btn w-full py-2.5 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <Plus size={16} />
            <span>DISPENSE NEW CASSETTE</span>
          </button>
        </form>
      </div>
    </div>
  );
}
