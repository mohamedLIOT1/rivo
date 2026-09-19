import React from 'react';
import { X, Share2, Camera, QrCode } from 'lucide-react';

export default function SpotifyCodeModal({ isOpen, onClose, currentTrack }) {
  if (!isOpen || !currentTrack) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-sm w-full p-6 flex flex-col items-center text-center relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose} 
          className="brutal-btn absolute top-3.5 right-3.5 p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]"
        >
          <X size={18} />
        </button>

        <div className="relative mb-3 mt-1">
          <img 
            src={currentTrack.cover} 
            alt={currentTrack.title} 
            className="w-36 h-36 brutal-border-thick object-cover bg-white"
            onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=R&background=082621&color=26c4b7`; }}
          />
          <div className="absolute top-0 right-0 bg-[#082621] text-[#26c4b7] text-[9px] font-mono font-black px-1.5 py-0.5">
            RIVO-REC
          </div>
        </div>

        <h3 className="text-lg font-display font-black text-[#082621] truncate max-w-full">{currentTrack.title}</h3>
        <p className="text-xs font-mono font-bold text-[#17a398] mb-4">{currentTrack.artist}</p>

        {/* Rivo Soundwave Barcode Graphic */}
        <div className="w-full bg-[#ede5d3] p-3 brutal-border flex flex-col items-center justify-center gap-2 mb-5">
          <div className="flex items-center gap-1.5 h-10 w-full justify-center">
            <div className="w-1.5 h-6 bg-[#082621]"></div>
            <div className="w-1.5 h-10 bg-[#082621]"></div>
            <div className="w-1.5 h-4 bg-[#082621]"></div>
            <div className="w-1.5 h-8 bg-[#082621]"></div>
            <div className="w-1.5 h-5 bg-[#082621]"></div>
            <div className="w-1.5 h-9 bg-[#082621]"></div>
            <div className="w-1.5 h-6 bg-[#082621]"></div>
            <div className="w-1.5 h-10 bg-[#082621]"></div>
            <div className="w-1.5 h-3 bg-[#082621]"></div>
            <div className="w-1.5 h-7 bg-[#082621]"></div>
            <div className="w-1.5 h-5 bg-[#082621]"></div>
            <div className="w-1.5 h-8 bg-[#082621]"></div>
          </div>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#082621]">
            RIVO SOUND PRESCRIPTION BARCODE
          </span>
        </div>

        <div className="flex items-center gap-2 w-full">
          <button 
            onClick={() => alert('Scanner active: Optical frequency receiver online.')}
            className="brutal-btn flex-1 py-2 bg-[#fdfbf7] hover:bg-white text-[#082621] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center justify-center gap-1.5"
          >
            <Camera size={14} />
            <span>SCAN BARCODE</span>
          </button>

          <button 
            onClick={() => alert(`Prescription barcode saved for ${currentTrack.title}`)}
            className="brutal-btn flex-1 py-2 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-1.5"
          >
            <Share2 size={14} />
            <span>EXPORT CODE</span>
          </button>
        </div>
      </div>
    </div>
  );
}
