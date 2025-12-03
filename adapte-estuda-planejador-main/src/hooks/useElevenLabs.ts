import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTtsAudio } from '@/lib/api';
import { LanguageCode } from '@/context/LanguageProvider';

// ElevenLabs key is now fully managed by the backend/env; no UI prompt or local storage is used.
const ELEVENLABS_ENABLED = ((import.meta as any).env?.VITE_ELEVENLABS_ENABLED ?? 'true') !== 'false';

export function useElevenLabs() {
  const [isAvailable, setIsAvailable] = useState<boolean>(ELEVENLABS_ENABLED);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsAvailable(ELEVENLABS_ENABLED);
  }, []);

  const stopElevenLabsAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
    } catch {
      // ignore pause errors
    }
    audio.src = "";
    audioRef.current = null;
  }, []);

  const speakWithElevenLabs = useCallback(
    async (text: string, language: LanguageCode, volume: number = 1): Promise<boolean> => {
      const cleanText = text?.trim();
      if (!isAvailable || !cleanText) return false;

      try {
        setIsLoading(true);
        stopElevenLabsAudio();

        const audioBlob = await fetchTtsAudio(cleanText, language, 'elevenlabs');
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.volume = Math.min(1, Math.max(0, volume));
        audioRef.current = audio;

        return new Promise((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            if (audioRef.current === audio) {
              audioRef.current = null;
            }
            resolve(true);
          };

          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            if (audioRef.current === audio) {
              audioRef.current = null;
            }
            resolve(false);
          };

          audio.play().catch(() => resolve(false));
        });
      } catch (error) {
        console.warn('ElevenLabs TTS error:', error);
        setIsAvailable(false);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isAvailable, stopElevenLabsAudio]
  );

  return {
    isAvailable,
    isLoading,
    speakWithElevenLabs,
    stopElevenLabsAudio,
  };
}
