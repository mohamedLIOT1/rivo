import React, { useState } from 'react';
import { X, User, Lock, Eye, EyeOff, LogIn, UserPlus, LogOut, Loader2, Award } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import VerifiedBadge from './VerifiedBadge';

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
    if (!email || !password) {
      setError(mode === 'register' ? 'Email and password required' : 'Email or Username and password required');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register'
        ? { name, email, password }
        : { identifier: email, email, username: email, password };
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
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg w-full max-w-sm overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[#0b1110] bg-[#ede5d3]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h2 className="text-xs font-mono font-black uppercase text-[#082621]">
              {currentUser ? 'PATIENT DOSSIER' : mode === 'login' ? 'PATIENT SIGN IN' : 'NEW PATIENT REGISTRATION'}
            </h2>
          </div>
          <button onClick={onClose} className="brutal-btn p-1 bg-[#fdfbf7] brutal-border hover:bg-[#ede5d3] text-[#0b1110]">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {/* ── Logged In View ── */}
          {currentUser ? (
            <div className="flex flex-col items-center gap-4 py-2">
              {/* Avatar */}
              <div className="w-20 h-20 bg-[#ede5d3] brutal-border-thick brutal-shadow overflow-hidden">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#082621] text-[#26c4b7] flex items-center justify-center text-3xl font-mono font-black">
                    {(currentUser.name || currentUser.email)?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <p className="text-lg font-display font-black text-[#082621]">{currentUser.name}</p>
                  <VerifiedBadge userOrName={currentUser} size={18} />
                </div>
                <p className="text-xs font-mono text-[#082621]/70 mt-0.5">{currentUser.email}</p>
              </div>

              <div className="w-full text-center text-[10px] font-mono font-black py-1.5 px-3 bg-[#ede5d3] text-[#082621] brutal-border">
                ✓ RIVO CERTIFIED CLINICAL PATIENT
              </div>

              <button
                onClick={handleLogout}
                className="brutal-btn w-full py-2.5 flex items-center justify-center gap-2 text-xs font-mono font-black uppercase text-[#dc2626] bg-red-50 hover:bg-red-100 brutal-border brutal-shadow-sm transition-all cursor-pointer"
              >
                <LogOut size={14} />
                <span>TERMINATE DISPENSARY SESSION</span>
              </button>
            </div>

          ) : (

            /* ── Auth Form ── */
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {error && (
                <div className="p-2.5 bg-red-100 border-2 border-[#dc2626] text-[#dc2626] text-xs font-mono font-bold text-center">
                  {error}
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">PATIENT NAME</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Dr. Mohamed"
                    className="w-full bg-[#ede5d3] text-[#0b1110] text-xs font-sans font-bold px-3 py-2 brutal-border focus:outline-none focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">
                  {mode === 'login' ? 'EMAIL OR USER IDENTIFIER' : 'OFFICIAL EMAIL'}
                </label>
                <input
                  type={mode === 'login' ? 'text' : 'email'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={mode === 'login' ? 'Username or email' : 'patient@hospital.org'}
                  required
                  className="w-full bg-[#ede5d3] text-[#0b1110] text-xs font-sans font-bold px-3 py-2 brutal-border focus:outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">SECRET CIPHER (PASSWORD)</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-[#ede5d3] text-[#0b1110] text-xs font-sans font-bold px-3 py-2 pr-9 brutal-border focus:outline-none focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#082621]/60 hover:text-[#0b1110]"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="brutal-btn w-full py-2.5 mt-2 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading
                  ? <Loader2 size={15} className="animate-spin" />
                  : mode === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />
                }
                <span>{isLoading ? 'VERIFYING...' : mode === 'login' ? 'ACCESS DISPENSARY' : 'REGISTER PATIENT'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-xs font-mono font-bold text-[#17a398] hover:underline text-center mt-1"
              >
                {mode === 'login'
                  ? "No medical registration? Create Patient ID"
                  : 'Already registered? Sign In to Dispensary'
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
