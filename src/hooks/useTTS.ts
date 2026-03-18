"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useTTS(paragraphs: { idId: string; en: string; id: string }[], activeChapterId: string) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1); // The index of the paragraph currently being read
  const [rate, setRate] = useState<number>(0.95);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Timer for Android 15-second TTS bug workaround
  const keepAliveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      // DO NOT reset activeIndex here, so user can resume exactly where they left off!
      const audioEl = document.getElementById('silentAudio') as HTMLAudioElement;
      if (audioEl) audioEl.pause();
      
      if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
    }
  }, []);

  // When chapter changes or paragraphs change significantly, stop audio
  useEffect(() => {
    stop();
  }, [activeChapterId, stop]);

  // Handle live rate adjustment while playing
  useEffect(() => {
      if (isPlaying && synthRef.current && activeIndex !== -1) {
          // Restart synthesis from the current active index to apply the new rate immediately
          stop();
          // Short timeout to allow previous cancel to process fully
          setTimeout(() => {
              play(activeIndex);
          }, 50);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate]);

  const play = useCallback(
    (startIndex: number = 0) => {
      if (!synthRef.current || paragraphs.length === 0) return;

      // Ensure we have voices loaded
      let voices = synthRef.current.getVoices();
      let idVoice = voices.find((v) => v.lang.startsWith("id-ID") || v.lang.startsWith("id_ID"));

      if (!idVoice) {
         // Fallback incase voices are still loading
         if (voices.length > 0) {
            idVoice = voices[0];
         }
      }

      synthRef.current.cancel();
      if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
      
      const playNext = (index: number) => {
        if (index >= paragraphs.length) {
          setIsPlaying(false);
          // Only clear index at the very end of the chapter
          setActiveIndex(-1);
          const audioEl = document.getElementById('silentAudio') as HTMLAudioElement;
          if (audioEl) audioEl.pause();
          return;
        }

        // Only play if there is an indonesian translation available
        const textToRead = paragraphs[index].id;
        
        if (!textToRead) {
           // Skip empty or untranslated
           playNext(index + 1);
           return;
        }

        setActiveIndex(index);
        
        // Scroll the active paragraph into view smoothly
        const el = document.getElementById(paragraphs[index].idId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        const utterance = new SpeechSynthesisUtterance(textToRead);
        if (idVoice) utterance.voice = idVoice;
        utterance.lang = "id-ID";
        utterance.rate = rate; // Configurable playback speed
        
        utterance.onend = () => {
          playNext(index + 1);
        };
        
        utterance.onerror = (e) => {
          console.error("Speech Synthesis Error:", e);
          // Do not fully stop the UI so the user can hit 'resume' easily from the last activeIndex
          setIsPlaying(false);
          const audioEl = document.getElementById('silentAudio') as HTMLAudioElement;
          if (audioEl) audioEl.pause();
          if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
        };

        utteranceRef.current = utterance;
        synthRef.current?.speak(utterance);
        
        // Update Media Session for Lock Screen controls
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: `Paragraf ${index + 1}`,
                artist: 'Infinity Mage',
                album: 'Chapter Audio',
            });
        }
      };

      setIsPlaying(true);
      setIsPaused(false);
      
      // Start the heavy hack: Play silent audio so mobile OS thinks music is running
      // Needs to be targeted by ID since it's in the DOM
      const audioEl = document.getElementById('silentAudio') as HTMLAudioElement;
      if (audioEl) {
          audioEl.play().catch(e => console.warn('Silent audio play blocked:', e));
      }

      // Android 15-second TTS bug heartbeat
      keepAliveTimerRef.current = setInterval(() => {
          if (synthRef.current && (synthRef.current.speaking || synthRef.current.paused)) {
              synthRef.current.pause();
              synthRef.current.resume();
          }
      }, 14000);

      playNext(startIndex);
    },
    [paragraphs, rate]
  );

  const pause = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.pause();
      setIsPaused(true);
      const audioEl = document.getElementById('silentAudio') as HTMLAudioElement;
      if (audioEl) audioEl.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.resume();
      setIsPaused(false);
      const audioEl = document.getElementById('silentAudio') as HTMLAudioElement;
      if (audioEl) audioEl.play().catch(() => {});
    }
  }, []);

  const toggleStatus = useCallback(() => {
      if (isPlaying) {
          if (isPaused) {
              resume();
          } else {
              pause();
          }
      } else {
          // Play from the previously saved active paragraph, or start from 0 if none
          play(activeIndex !== -1 ? activeIndex : 0);
      }
  }, [isPlaying, isPaused, play, pause, resume, activeIndex]);

  // Handle MediaSession action handlers
  useEffect(() => {
      if ('mediaSession' in navigator) {
          navigator.mediaSession.setActionHandler('play', () => toggleStatus());
          navigator.mediaSession.setActionHandler('pause', () => toggleStatus());
          
          return () => {
              navigator.mediaSession.setActionHandler('play', null);
              navigator.mediaSession.setActionHandler('pause', null);
          }
      }
  }, [toggleStatus]);

  return {
    isPlaying,
    isPaused,
    activeIndex,
    rate,
    setRate,
    play,
    pause,
    resume,
    stop,
    toggleStatus
  };
}
