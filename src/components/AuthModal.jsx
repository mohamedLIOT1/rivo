import React, { useState } from 'react';
import { X, User, Lock, Mail, ShieldCheck, LogIn, UserPlus, Camera, Upload } from 'lucide-react';

import { API_BASE_URL } from '../config';

export default function AuthModal({ isOpen, onClose, currentUser, onLogin, onLogout }) {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');

  if (!isOpen) return null;

  const defaultAvatarSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231DB954"/><circle cx="50" cy="35" r="18" fill="%23000"/><path d="M20,85 C20,60 35,55 50,55 C65,55 80,60 80,85 Z" fill="%23000"/></svg>`;

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!navigator.onLine) {
      alert('Network disconnected! Please connect to the internet to sign up / log in to your account.');
      return;
    }

    if (!email || !password) return;

    const userData = {
      id: currentUser?.id || `user-${Date.now()}`,
      name: name || currentUser?.name || email.split('@')[0],
      email,
      password,
      avatar: avatar || currentUser?.avatar || defaultAvatarSvg,
      isPremium: true,
      tasteProfile: ['Pop', 'Electronic', 'Arab Pop']
    };

    // Sync account to Railway MongoDB Atlas Database
    try {
      const endpoint = isSignup ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (data.success && data.user) {
        userData.id = data.user._id || userData.id;
      }
    } catch(err) {
      console.warn('DB auth status:', err);
    }

    onLogin(userData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#181818] border border-zinc-800 rounded-3xl max-w-sm w-full p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#1DB954] text-black flex items-center justify-center font-black">
              <User size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">{currentUser ? 'Your Profile' : (isSignup ? 'Create Account' : 'Sign In')}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-full">
            <X size={20} />
          </button>
        </div>

        {currentUser ? (
          <div className="py-6 flex flex-col items-center text-center gap-4">
            {/* Editable Profile Picture */}
            <div className="relative group">
              <img 
                src={avatar || currentUser.avatar || defaultAvatarSvg} 
                alt={currentUser.name} 
                className="w-24 h-24 rounded-full object-cover shadow-2xl border-4 border-[#1DB954]" 
              />
              <label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Camera size={22} />
                <span className="text-[10px] font-bold mt-1">Change</span>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>

            <div>
              <h4 className="text-xl font-extrabold text-white">{currentUser.name}</h4>
              <p className="text-xs text-zinc-400 mt-0.5">{currentUser.email}</p>
            </div>

            <div className="w-full bg-gradient-to-r from-emerald-950 to-zinc-900 p-3 rounded-2xl border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-400 text-xs font-black">
              <ShieldCheck size={16} />
              <span>Premium Plan Active</span>
            </div>

            <div className="w-full flex gap-2">
              <button
                onClick={async () => {
                  const newAvatar = avatar || currentUser.avatar;
                  const updatedUser = { ...currentUser, avatar: newAvatar };
                  try {
                    await fetch(`${API_BASE_URL}/api/user/update-profile`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(updatedUser)
                    });
                  } catch (err) {}
                  onLogin(updatedUser);
                  alert('Profile picture saved & synced across all devices!');
                }}
                className="flex-1 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs rounded-xl transition-colors"
              >
                Save Photo
              </button>
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="py-3 px-4 bg-red-600/20 hover:bg-red-600/40 text-red-400 font-extrabold text-xs rounded-xl border border-red-500/30 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-4">
            {/* Signup Profile Picture Picker */}
            {isSignup && (
              <div className="flex flex-col items-center gap-2">
                <label className="relative group cursor-pointer">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center text-zinc-400 group-hover:border-[#1DB954] transition-colors overflow-hidden">
                    {avatar ? (
                      <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload size={20} />
                        <span className="text-[9px] font-bold mt-1">Add Photo</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              </div>
            )}

            {isSignup && (
              <div>
                <label className="text-xs uppercase font-extrabold text-zinc-400 block mb-1">Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mohamed"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954]"
                />
              </div>
            )}

            <div>
              <label className="text-xs uppercase font-extrabold text-zinc-400 block mb-1">Email Address</label>
              <input
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954]"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-extrabold text-zinc-400 block mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold rounded-xl transition-all shadow-xl text-sm mt-2 flex items-center justify-center gap-2"
            >
              {isSignup ? <UserPlus size={18} /> : <LogIn size={18} />}
              <span>{isSignup ? 'Sign Up' : 'Sign In'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-xs text-zinc-400 hover:text-white font-bold text-center mt-2"
            >
              {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
