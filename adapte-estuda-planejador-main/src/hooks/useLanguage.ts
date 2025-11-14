import { useLanguageContext } from '@/context/LanguageProvider';

// Thin hook that exposes the global language context
export const useLanguage = () => {
  return useLanguageContext();
};

export type { LanguageCode, LanguageOption } from '@/context/LanguageProvider';