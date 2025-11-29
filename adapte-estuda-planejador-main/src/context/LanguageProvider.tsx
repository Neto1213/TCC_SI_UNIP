import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode, useRef } from 'react';
import { languages, type Translations } from '@/i18n';
import { useElevenLabs } from '@/hooks/useElevenLabs';
import { fetchTtsAudio } from '@/lib/api';
import { collectReadableText } from '@/utils/readableText';

export type LanguageCode = 'pt' | 'en' | 'es';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  flag: string;
}

// Restrito a português: demais idiomas ficam indisponíveis para a voz/TTS.
const languageOptions: LanguageOption[] = [{ code: 'pt', name: 'Português', flag: '🇧🇷' }];

const langMap: Record<LanguageCode, string> = {
  pt: 'pt-BR',
};

interface LanguageContextValue {
  currentLanguage: LanguageCode;
  changeLanguage: (code: LanguageCode) => void;
  voiceOn: boolean;
  toggleVoice: () => void;
  speakText: (text: string) => void;
  texts: Translations;
  languageOptions: LanguageOption[];
  voicesCount: number;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('pt');
  const [voiceOn, setVoiceOn] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const { isAvailable: elevenLabsAvailable, speakWithElevenLabs, stopElevenLabsAudio } = useElevenLabs();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load voices once
  useEffect(() => {
    let mounted = true;

    const loadVoices = () => {
      const v = speechSynthesis.getVoices();
      if (mounted && v && v.length) setVoices(v);
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Fallback polling
    let tries = 0;
    const interval = setInterval(() => {
      tries += 1;
      loadVoices();
      if (voices.length || tries > 10) clearInterval(interval);
    }, 300);

    return () => {
      mounted = false;
      if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = null;
      clearInterval(interval);
    };
  }, [voices.length]);

  const chooseVoiceForLanguage = useCallback((langCode: LanguageCode) => {
    if (!voices.length) return null;
    const target = langMap[langCode] || langMap.pt;
    const prefix = target.split('-')[0].toLowerCase();

    let v = voices.find(vo => vo.lang && vo.lang.toLowerCase().startsWith(prefix) && /female|femme|mujer|donna|女性/i.test(vo.name));
    if (v) return v;

    v = voices.find(vo => vo.lang && vo.lang.toLowerCase().startsWith(prefix));
    if (v) return v;

    v = voices.find(vo => /female|femme|mujer|donna|女性/i.test(vo.name));
    if (v) return v;

    return voices[0];
  }, [voices]);

  const stopCurrentAudio = useCallback(() => {
    // Stop ElevenLabs playback too so new clicks interrupt immediately.
    stopElevenLabsAudio();
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
      } catch {
        // ignore pause failure
      }
      audio.src = "";
      audioRef.current = null;
    }
  }, [stopElevenLabsAudio]);

  useEffect(() => () => {
    stopCurrentAudio();
  }, [stopCurrentAudio]);

  const playAudioBlob = useCallback((blob: Blob) => {
    return new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        reject(new Error("Falha ao reproduzir áudio TTS."));
      };

      audio
        .play()
        .catch((err) => {
          URL.revokeObjectURL(url);
          if (audioRef.current === audio) {
            audioRef.current = null;
          }
          reject(err);
        });
    });
  }, []);

  const speakWithSelfHosted = useCallback(
    async (text: string) => {
      try {
        const blob = await fetchTtsAudio(text, currentLanguage);
        await playAudioBlob(blob);
        return true;
      } catch {
        return false;
      }
    },
    [currentLanguage, playAudioBlob]
  );

  const resolveReadableText = useCallback((fallback?: string) => {
    // Prioritize explicit text (e.g., hovered/clicked element); when none is provided, read the whole page/selection.
    const shouldReadPage = !(fallback && fallback.trim());
    return collectReadableText({ fallback, includePage: shouldReadPage });
  }, []);

  const extractTextFromNode = useCallback((node?: EventTarget | null) => {
    if (!node || typeof document === 'undefined') return '';
    const el = node as HTMLElement;
    const marked = el.closest?.('[data-elevenlabs-readable]') as HTMLElement | null;
    const candidate = (marked?.innerText || el.innerText || el.textContent || '').trim();
    return candidate;
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (!voiceOn || typeof window === 'undefined') return;

    const textToSpeak = resolveReadableText(text);
    if (!textToSpeak) return;

    stopCurrentAudio();
    speechSynthesis.cancel();

    // Try ElevenLabs first for better quality
    if (elevenLabsAvailable) {
      const success = await speakWithElevenLabs(textToSpeak, currentLanguage);
      if (success) return;
    }

    // Fallback to Piper/self-hosted endpoint
    const selfHostedOk = await speakWithSelfHosted(textToSpeak);
    if (selfHostedOk) return;

    // Last fallback: native speech synthesis
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = langMap[currentLanguage];
    const chosen = chooseVoiceForLanguage(currentLanguage);
    if (chosen) utterance.voice = chosen;

    try {
      speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  }, [voiceOn, currentLanguage, chooseVoiceForLanguage, elevenLabsAvailable, speakWithElevenLabs, speakWithSelfHosted, stopCurrentAudio, resolveReadableText]);

  const toggleVoice = useCallback(() => {
    setVoiceOn((prev) => {
      const next = !prev;
      if (!next) {
        stopCurrentAudio();
        speechSynthesis.cancel();
      }
      return next;
    });
  }, [stopCurrentAudio]);
  const changeLanguage = useCallback((code: LanguageCode) => {
    // Mantém português como única língua disponível; ignoramos seleções diferentes.
    setCurrentLanguage(code === 'pt' ? 'pt' : 'pt');
    speechSynthesis.cancel();
    stopCurrentAudio();
  }, [stopCurrentAudio]);

  useEffect(() => {
    if (!voiceOn || typeof window === 'undefined') return;

    const handleClickToSpeak = (event: MouseEvent) => {
      const targetText = extractTextFromNode(event.target);
      const resolved = resolveReadableText(targetText);
      if (resolved) {
        speakText(resolved);
      }
    };

    // Lê o conteúdo clicado (inclui textos carregados dinamicamente do DOM).
    window.addEventListener('click', handleClickToSpeak, true);
    return () => {
      window.removeEventListener('click', handleClickToSpeak, true);
    };
  }, [voiceOn, extractTextFromNode, resolveReadableText, speakText]);

  const texts = useMemo(() => languages[currentLanguage] || languages.en, [currentLanguage]);

  const value: LanguageContextValue = useMemo(() => ({
    currentLanguage,
    changeLanguage,
    voiceOn,
    toggleVoice,
    speakText,
    texts,
    languageOptions,
    voicesCount: voices.length,
  }), [currentLanguage, changeLanguage, voiceOn, toggleVoice, speakText, texts, voices.length]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguageContext() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguageContext must be used within LanguageProvider');
  return ctx;
}
