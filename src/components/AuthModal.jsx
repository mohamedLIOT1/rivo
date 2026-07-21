import React, { useState } from 'react';
import { X, User, Lock, Eye, EyeOff, LogIn, UserPlus, LogOut, Camera, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';

export default function AuthModal({ isOpen, onClose }) {
  const { currentUser, login, logout } = useUser();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password required'); return; }
    setIsLoading(true);
    setError('');
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register' ? { name, email, password } : { email, password };
      const res  = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Something went wrong'); return; }
      login(data.user, data.token);
      onClose();
    } catch {
      setError('Network error. Please try again.');
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center">
              <User size={16} className="text-black" />
            </div>
            <h2 className="text-base font-extrabold text-white">
              {currentUser ? 'My Account' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#b3b3b3] hover:text-white rounded-full hover:bg-white/10 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">

          {/* ── Logged In View ── */}
          {currentUser ? (
            <div className="flex flex-col items-center gap-4 py-2">
              {/* Avatar */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#1DB954] shadow-xl">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1DB954] to-[#169c46] flex items-center justify-center text-black text-3xl font-black">
                      {(currentUser.name || currentUser.email)?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center">
                <p className="text-xl font-extrabold text-white">{currentUser.name}</p>
                <p className="text-sm text-[#b3b3b3] mt-0.5">{currentUser.email}</p>
              </div>

              <div 
                className="w-full text-center text-xs font-bold py-2 px-4 rounded-full"
                style={{ background: '#1DB95420', color: '#1DB954', border: '1px solid #1DB95440' }}
              >
                ✓ Synced across all devices
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-bold text-red-400 border border-red-400/30 rounded-full hover:bg-red-400/10 transition-all"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>

          ) : (

            /* ── Auth Form ── */
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label className="text-xs font-bold text-[#b3b3b3] block mb-1.5">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Mohamed"
                    className="w-full bg-[#282828] text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#1DB954]"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#b3b3b3] block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-[#282828] text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#1DB954]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#b3b3b3] block mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-[#282828] text-white text-sm px-4 py-2.5 pr-10 rounded-xl border border-white/10 focus:outline-none focus:border-[#1DB954]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b3b3b3] hover:text-white"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-2 bg-[#1DB954] text-black font-extrabold text-sm rounded-full hover:bg-[#1ed760] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoading
                  ? <Loader2 size={16} className="animate-spin" />
                  : mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />
                }
                {isLoading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>

              <button
                type="button"
                onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-sm text-[#b3b3b3] hover:text-white text-center mt-1 font-medium"
              >
                {mode === 'login'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
