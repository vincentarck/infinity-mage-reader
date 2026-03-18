"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useTTS(paragraphs: { idId: string; en: string; id: string }[], activeChapterId: string) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1); // The index of the paragraph currently being read
  const [rate, setRate] = useState<number>(0.95);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
      setActiveIndex(-1);
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
      
      const playNext = (index: number) => {
        if (index >= paragraphs.length) {
          setIsPlaying(false);
          setActiveIndex(-1);
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
          setIsPlaying(false);
        };

        utteranceRef.current = utterance;
        synthRef.current?.speak(utterance);
      };

      setIsPlaying(true);
      setIsPaused(false);
      playNext(startIndex);
    },
    [paragraphs, rate]
  );

  const pause = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.resume();
      setIsPaused(false);
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
          // Play from paragraph currently in view, or start from 0
          play(0);
      }
  }, [isPlaying, isPaused, play, pause, resume]);

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
