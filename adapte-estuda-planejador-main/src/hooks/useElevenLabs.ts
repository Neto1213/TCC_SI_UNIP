import { useCallback, useEffect, useState } from 'react';
import { LanguageCode } from '@/context/LanguageProvider';

interface ElevenLabsOptions {
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
}

const VOICE_MAP: Record<LanguageCode, ElevenLabsOptions> = {
  pt: {
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah
    modelId: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.0
  },
  en: {
    voiceId: '9BWtsMINqrJLrRacOk9x', // Aria
    modelId: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.0
  },
  es: {
    voiceId: 'XB0fDUnXU5powFXDhCwa', // Charlotte
    modelId: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.0
  },
};

export function useElevenLabs() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have stored API key in localStorage for now
    // In production, this would come from Supabase edge function
    const storedKey = localStorage.getItem('elevenlabs_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setIsAvailable(true);
    } else {
      // For now, we'll use a simple prompt to get the key
      // In production, this would be handled more securely
      const key = prompt('Enter your ElevenLabs API key (optional - for better voice quality):');
      if (key && key.trim()) {
        localStorage.setItem('elevenlabs_api_key', key);
        setApiKey(key);
        setIsAvailable(true);
      }
    }
  }, []);

  const speakWithElevenLabs = useCallback(async (text: string, language: LanguageCode): Promise<boolean> => {
    if (!isAvailable || !apiKey || !text.trim()) return false;

    try {
      setIsLoading(true);
      
      const voiceConfig = VOICE_MAP[language];
      if (!voiceConfig) return false;

      // Direct API call to ElevenLabs
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: voiceConfig.modelId,
          voice_settings: {
            stability: voiceConfig.stability,
            similarity_boost: voiceConfig.similarityBoost,
            style: voiceConfig.style,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        console.warn('ElevenLabs API request failed:', response.statusText);
        return false;
      }

      // Get the audio data
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Play the audio
      const audio = new Audio(audioUrl);
      
      return new Promise((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve(true);
        };
        
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          resolve(false);
        };
        
        audio.play().catch(() => resolve(false));
      });

    } catch (error) {
      console.warn('ElevenLabs TTS error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, apiKey]);

  const clearApiKey = useCallback(() => {
    localStorage.removeItem('elevenlabs_api_key');
    setApiKey(null);
    setIsAvailable(false);
  }, []);

  return {
    isAvailable,
    isLoading,
    speakWithElevenLabs,
    clearApiKey,
    hasApiKey: !!apiKey
  };
}