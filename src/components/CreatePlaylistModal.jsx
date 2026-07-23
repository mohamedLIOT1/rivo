import React, { useState } from 'react';
import { X, Plus, Music, Camera, Globe, Lock, Image } from 'lucide-react';

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
    const defaultCover = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=1DB954&color=000&size=512&bold=true&format=svg`;
    onCreatePlaylist(title.trim(), description.trim(), cover || defaultCover, isPublic);
    setTitle('');
    setDescription('');
    setCover('');
    setCoverPreview('');
    setIsPublic(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#181818] border border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Plus className="text-[#1DB954]" size={22} />
            <h3 className="text-lg font-bold text-white">إنشاء قائمة تشغيل (Create Playlist)</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-4">
          
          {/* Cover Art Selector */}
          <div className="flex items-center gap-4">
            <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-[#1DB954] flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group shrink-0 bg-zinc-900">
              {coverPreview ? (
                <img src={coverPreview} alt="cover preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-zinc-500 group-hover:text-white transition-colors">
                  <Camera size={24} />
                  <span className="text-[10px] font-bold">صورة الغلاف</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={20} className="text-white" />
              </div>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>

            <div className="flex-1">
              <label className="text-xs uppercase font-extrabold text-zinc-400 block mb-1">عنوان القائمة *</label>
              <input
                type="text"
                placeholder="مثال: أغاني الروقان ☕"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase font-extrabold text-zinc-400 block mb-1">وصف القائمة (اختياري)</label>
            <textarea
              placeholder="اكتب وصفاً جزيلاً لقائمتك..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] resize-none"
            />
          </div>

          {/* Privacy Toggle */}
          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {isPublic ? <Globe size={18} className="text-[#1DB954]" /> : <Lock size={18} className="text-amber-400" />}
              <div>
                <p className="text-xs font-bold text-white">{isPublic ? 'عامة (ظاهرة بالبروفايل)' : 'خاصة (مخفية عن الآخرين)'}</p>
                <p className="text-[10px] text-zinc-400">{isPublic ? 'يستطيع الآخرون رؤيتها في ملفك الشخصي' : 'فقط أنت من تستطيع رؤيتها'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(p => !p)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isPublic ? 'bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {isPublic ? 'عامة 👁️' : 'خاصة 🔒'}
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold rounded-xl transition-all shadow-lg shadow-[#1DB954]/20 mt-1 cursor-pointer"
          >
            إنشاء قائمة التشغيل
          </button>
        </form>
      </div>
    </div>
  );
}
