import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Radio, Music, Loader2, User } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ChatModal({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  socket,
  onStartJamWithUser,
  onPlayTrack
}) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen || !targetUser?.id) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('liofy_token');
        const res = await fetch(`${API_BASE_URL}/api/chat/${targetUser.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    };

    fetchHistory();
  }, [isOpen, targetUser?.id]);

  // Listen to incoming socket messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      if (
        (msg.sender === targetUser?.id && msg.recipient === currentUser?.id) ||
        (msg.sender === currentUser?.id && msg.recipient === targetUser?.id)
      ) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(scrollToBottom, 100);
      }
    };

    socket.on('chat:message', handleMessage);
    return () => socket.off('chat:message', handleMessage);
  }, [socket, targetUser?.id, currentUser?.id]);

  if (!isOpen || !targetUser) return null;

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const token = localStorage.getItem('liofy_token');
      const res = await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId: targetUser.id,
          text
        })
      });
      const data = await res.json();
      if (data.success && data.message) {
        // If socket is disconnected, append locally
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    setSending(false);
  };

  const handleSendJamInvite = async () => {
    if (onStartJamWithUser) {
      onStartJamWithUser(targetUser);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-lg h-[560px] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0 border border-white/10">
              {targetUser.avatar ? (
                <img src={targetUser.avatar} alt={targetUser.name} className="w-full h-full object-cover" />
              ) : (
                <User size={20} className="text-zinc-400" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">{targetUser.name}</h3>
              <p className="text-xs text-[#1DB954] font-medium">Direct Chat</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSendJamInvite}
              className="px-3 py-1.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
              title="Invite to Jam"
            >
              <Radio size={14} />
              <span>Jam Invite</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-zinc-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 mb-2">
                <Radio size={24} />
              </div>
              <p className="text-sm font-semibold text-zinc-300">Start the conversation</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                Say hello, share music, or invite {targetUser.name} to a Jam session!
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = String(msg.sender) === String(currentUser?.id);
              return (
                <div
                  key={msg._id || idx}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                      isMe
                        ? 'bg-[#1DB954] text-black font-medium rounded-br-none'
                        : 'bg-zinc-800 text-white rounded-bl-none border border-white/5'
                    }`}
                  >
                    {msg.text && <p className="break-words">{msg.text}</p>}
                    
                    {/* Track attached */}
                    {msg.track && (
                      <div
                        onClick={() => onPlayTrack && onPlayTrack(msg.track)}
                        className={`mt-2 p-2 rounded-xl flex items-center gap-2.5 cursor-pointer ${
                          isMe ? 'bg-black/20' : 'bg-black/40'
                        }`}
                      >
                        <img
                          src={msg.track.cover}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover"
                        />
                        <div className="truncate flex-1">
                          <p className="text-xs font-bold truncate">{msg.track.title}</p>
                          <p className="text-[10px] opacity-80 truncate">{msg.track.artist}</p>
                        </div>
                        <Music size={14} className="shrink-0" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 px-1">
                    {msg.createdAt
                      ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-zinc-900/40 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Message ${targetUser.name}...`}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-2.5 rounded-xl bg-[#1DB954] text-black hover:bg-[#1ed760] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#1DB954] transition-all"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>

      </div>
    </div>
  );
}
