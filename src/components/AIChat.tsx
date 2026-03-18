"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type AIChatProps = {
  isOpen: boolean;
  onClose: () => void;
  activeChapterId?: string;
};

export default function AIChat({ isOpen, onClose, activeChapterId }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Halo! Saya asisten AI untuk Infinity Mage. Ada yang bisa saya bantu tentang novel ini? (Sebutkan chapter jika ingin spesifik, misal: 'Tolong ringkaskan chapter 186')" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Create a temporary history array sending the newest message to context
      const chatHistory = [...messages, userMsg];

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: chatHistory,
          currentChapterId: activeChapterId 
        })
      });

      const data = await res.json();
      
      if (res.ok && data.content) {
         setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      } else {
         throw new Error(data.error || "Gagal menghubungi AI");
      }
    } catch (err: any) {
       console.error(err);
       setMessages(prev => [...prev, { role: 'assistant', content: `Maaf, terjadi kesalahan: ${err.message}` }]);
    } finally {
       setIsLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
       {/* Backdrop to close */}
       <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
       
       {/* Sidebar Chat Container */}
       <div className="glass" style={{ 
          position: 'relative', width: '400px', maxWidth: '100vw', height: '100%',
          background: 'var(--surface-color)', display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid var(--glass-border)'
       }}>
          {/* Header */}
          <div className="flex justify-between items-center" style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
             <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>✨ Infinity Mage AI</h2>
             <button className="btn btn-icon" onClick={onClose}>✕</button>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             {messages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role}`} style={{ 
                   alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                   maxWidth: '85%',
                   padding: '0.8rem 1rem',
                   borderRadius: msg.role === 'user' ? '18px 18px 0px 18px' : '18px 18px 18px 0px',
                   background: msg.role === 'user' ? 'var(--accent-color)' : 'var(--surface-color-elevated)',
                   color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                   lineHeight: 1.5,
                   fontSize: '0.95rem'
                }}>
                   {msg.role === 'user' ? (
                      msg.content
                   ) : (
                      <div className="prose prose-invert max-w-none markdown-body">
                         <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                   )}
                </div>
             ))}
             {isLoading && (
                 <div style={{ alignSelf: 'flex-start', background: 'var(--surface-color-elevated)', padding: '0.8rem 1rem', borderRadius: '18px 18px 18px 0px', display: 'flex', gap: '5px' }}>
                    <div className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }}/>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Berpikir...</span>
                 </div>
             )}
             <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
             <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Tanya soal chapter/tokoh..."
                  style={{ 
                    flex: 1, padding: '0.8rem', borderRadius: '50px', 
                    background: 'var(--background-color)', border: '1px solid var(--glass-border)',
                    color: 'var(--text-primary)', outline: 'none'
                  }}
                  disabled={isLoading}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  style={{ borderRadius: '50px', padding: '0 1.2rem' }}
                >
                   Kirim
                </button>
             </div>
          </div>
       </div>
    </div>
  );
}
