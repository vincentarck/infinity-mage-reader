"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTTS } from "../hooks/useTTS";
import AIChat from "./AIChat";

type ChapterRef = {
  id: string;
  number: number;
  title: string;
};

type ParagraphData = {
  idId: string; // unique ID
  en: string; // English text
  id: string; // Indonesian translated text
};

export default function Reader() {
  const [chapters, setChapters] = useState<ChapterRef[]>([]);
  const [activeChapter, setActiveChapter] = useState<ChapterRef | null>(null);
  const [paragraphs, setParagraphs] = useState<ParagraphData[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // Settings
  const [fontSize, setFontSize] = useState(1.125);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Initialize Speech Synthesis Voices
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }
  }, []);

  // Fetch Chapter List
  useEffect(() => {
    fetch('/api/chapters')
      .then(res => res.json())
      .then((data: ChapterRef[]) => {
        setChapters(data);
        setIsLoadingChapters(false);
        
        // Restore progress
        const savedId = localStorage.getItem('lastChapterId');
        if (savedId && data.find(c => c.id === savedId)) {
          loadChapter(data.find(c => c.id === savedId)!);
        } else if (data.length > 0) {
          loadChapter(data[0]);
        }
      });
  }, []);

  const { isPlaying, isPaused, activeIndex, rate, setRate, play, stop, toggleStatus } = useTTS(paragraphs, activeChapter?.id || '');
  const [searchQuery, setSearchQuery] = useState("");

  // Track progress when reading and infinite scroll trigger
  const handleScroll = useCallback(() => {
    if (!activeChapter) return;
    localStorage.setItem('lastScrollY', window.scrollY.toString());

    // Auto-load next chapter when near bottom
    if (!isLoadingContent && chapters.length > 0) {
      const scrollPos = window.innerHeight + window.scrollY;
      const bottomPos = document.body.offsetHeight - 200; // 200px threshold
      
      if (scrollPos >= bottomPos) {
        const currentIndex = chapters.findIndex(c => c.id === activeChapter.id);
        if (currentIndex !== -1 && currentIndex < chapters.length - 1) {
          // Debounce slightly to avoid rapid triggers
          setIsLoadingContent(true);
          setTimeout(() => {
             localStorage.removeItem('lastScrollY'); 
             loadChapter(chapters[currentIndex + 1]);
          }, 300);
        }
      }
    }
  }, [activeChapter, isLoadingContent, chapters]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const translateParagraphs = async (rawParagraphs: string[]) => {
    // Translate in chunks or one by one. For free API, let's translate one by one to avoid large payloads failing
    // We will build the new layout reactively
    const newParagraphs = rawParagraphs.map((p, i) => ({
      idId: `para-${i}`,
      en: p,
      id: "Translating..."
    }));
    
    setParagraphs([...newParagraphs]);

    for (let i = 0; i < rawParagraphs.length; i++) {
        try {
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: rawParagraphs[i], targetLang: 'id', sourceLang: 'en' })
            });
            const data = await res.json();
            
            setParagraphs(prev => {
                const updated = [...prev];
                if (updated[i]) {
                    updated[i].id = data.translatedText || "Translation failed";
                }
                return updated;
            });
        } catch (err) {
            console.error(err);
             setParagraphs(prev => {
                const updated = [...prev];
                if (updated[i]) updated[i].id = "Translation failed (API Error)";
                return updated;
            });
        }
    }
  };

  const loadChapter = async (chapter: ChapterRef) => {
    setIsLoadingContent(true);
    setActiveChapter(chapter);
    localStorage.setItem('lastChapterId', chapter.id);
    stop(); // stop any playing audio
    
    try {
      const res = await fetch(`/api/chapters/${encodeURIComponent(chapter.id)}`);
      const data = await res.json();
      
      // Auto translate paragraphs
      translateParagraphs(data.paragraphs);
      
      // Restore scroll if it was the last chapter we were just reading
      // Give a tiny timeout so DOM renders
      setTimeout(() => {
          const savedScrollY = localStorage.getItem('lastScrollY');
          if (savedScrollY) {
            window.scrollTo({ top: parseInt(savedScrollY), behavior: 'smooth' });
          } else {
            window.scrollTo(0, 0);
          }
      }, 100);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const loadNextChapter = () => {
    if (!activeChapter || chapters.length === 0) return;
    const currentIndex = chapters.findIndex(c => c.id === activeChapter.id);
    if (currentIndex < chapters.length - 1) {
      localStorage.removeItem('lastScrollY'); // reset scroll for new chapter
      loadChapter(chapters[currentIndex + 1]);
    }
  };

  const loadPrevChapter = () => {
    if (!activeChapter || chapters.length === 0) return;
    const currentIndex = chapters.findIndex(c => c.id === activeChapter.id);
    if (currentIndex > 0) {
      localStorage.removeItem('lastScrollY'); // reset scroll for new chapter
      loadChapter(chapters[currentIndex - 1]);
    }
  };

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Header NavBar - Glassmorphism */}
      <nav className="glass" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '60px', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem'
      }}>
        <div className="flex items-center gap-4">
          <button className="btn btn-icon" onClick={() => setIsSidebarOpen(true)}>
            ☰
          </button>
          <div style={{ fontWeight: 600, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '40vw' }}>
            {activeChapter ? activeChapter.title : 'Loading...'}
          </div>
        </div>

        <div className="flex items-center gap-2">
            <button className="btn" onClick={() => setIsChatOpen(true)}>✨ AI Chat</button>
            <button className="btn" onClick={() => setFontSize(f => Math.max(0.8, f - 0.1))}>A-</button>
            <button className="btn" onClick={() => setFontSize(f => Math.min(2, f + 0.1))}>A+</button>
        </div>
      </nav>

      {/* Floating Audio Controls */}
      <div className="glass" style={{
        position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, borderRadius: '50px', padding: '10px 20px', display: 'flex', gap: '10px', alignItems: 'center'
      }}>
        <button className="btn" onClick={() => play(Math.max(0, activeIndex - 1))} title="Previous Paragraph" style={{ padding: '0.5rem' }}>
            ⏮
        </button>
        <button className="btn btn-primary" onClick={toggleStatus} style={{ minWidth: '80px' }}>
           {isPlaying && !isPaused ? 'Pause ⏸' : 'Play ▶'}
        </button>
        <button className="btn" onClick={stop} title="Stop" style={{ padding: '0.5rem' }}>
           ⏹
        </button>
        <button className="btn" onClick={() => { stop(); play(activeIndex + 1); }} title="Next Paragraph" style={{ padding: '0.5rem' }}>
            ⏭
        </button>
        <select 
          className="btn"
          value={rate}
          onChange={(e) => {
             const newRate = parseFloat(e.target.value);
             setRate(newRate);
          }}
          style={{ padding: '0.5rem' }}
        >
          <option value="0.5">0.5x</option>
          <option value="0.75">0.75x</option>
          <option value="0.95">0.95x</option>
          <option value="1">1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
          <option value="2.5">2.5x</option>
          <option value="3">3x</option>
          <option value="4">4x</option>
          <option value="5">5x</option>
          <option value="6">6x</option>
          <option value="7">7x</option>
          <option value="8">8x</option>
          <option value="9">9x</option>
          <option value="10">10x</option>
        </select>
      </div>

      {/* Main Content */}
      <main className="container" style={{ marginTop: '90px' }}>
        {isLoadingContent ? (
          <div className="flex-col gap-4" style={{ display: 'flex' }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton" style={{ height: '80px', width: '100%' }} />
            ))}
          </div>
        ) : (
          <article className="reader-content" style={{ fontSize: `${fontSize}rem` }}>
             {paragraphs.map((p, index) => (
               <div key={p.idId} id={p.idId} className={`para-group animate-fade-in ${activeIndex === index ? 'active-audio' : ''}`}>
                 <div className="en-text">{p.en}</div>
                 <div className="id-text">{p.id}</div>
               </div>
             ))}
          </article>
        )}

        {/* Chapter Navigation Footer */}
        <div className="flex justify-between" style={{ marginTop: '4rem', padding: '2rem 0', borderTop: '1px solid var(--glass-border)' }}>
            <button className="btn" onClick={loadPrevChapter}>Previous Chapter</button>
            <button className="btn btn-primary" onClick={loadNextChapter}>Next Chapter</button>
        </div>
      </main>

      {/* Sidebar Drawer */}
      {isSidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setIsSidebarOpen(false)} />
          <div className="glass" style={{ 
            position: 'absolute', top: 0, left: 0, bottom: 0, width: '300px', 
            maxWidth: '100vw', background: 'var(--surface-color)', padding: '1rem',
            display: 'flex', flexDirection: 'column'
          }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1rem', flexShrink: 0 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Chapters</h2>
              <button className="btn btn-icon" onClick={() => setIsSidebarOpen(false)}>✕</button>
            </div>

            <div style={{ marginBottom: '1rem', flexShrink: 0 }}>
              <input 
                 type="text" 
                 placeholder="Search chapter... (e.g. 100)" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 style={{ 
                   width: '100%', padding: '0.8rem', borderRadius: '6px', 
                   background: 'var(--surface-color-elevated)', border: '1px solid var(--glass-border)',
                   color: 'var(--text-primary)', outline: 'none'
                 }}
              />
            </div>
            
            {isLoadingChapters ? (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div className="spinner" />
                </div>
            ) : (
                <div className="flex-col gap-2" style={{ display: 'flex', overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
                {chapters
                  .filter(c => c.number.toString().includes(searchQuery.toLowerCase()) || c.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(c => (
                    <button 
                      key={c.id} 
                      className="btn w-full" 
                      style={{ 
                          justifyContent: 'flex-start', textAlign: 'left',
                          borderColor: activeChapter?.id === c.id ? 'var(--accent-color)' : 'transparent'
                      }}
                      onClick={() => { loadChapter(c); setIsSidebarOpen(false); }}
                    >
                      Chapter {c.number}
                    </button>
                ))}
                </div>
            )}
          </div>
        </div>
      )}

      {/* AI Chat Sidebar */}
      <AIChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        activeChapterId={activeChapter?.id} 
      />

    </div>
  );
}
