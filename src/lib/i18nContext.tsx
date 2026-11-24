import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { pickText, type BilingualText, type Language } from '../engine/i18n';

interface I18nContextValue {
  lang: Language;
  isRtl: boolean;
  setLang: (next: Language) => void;
  toggleLang: () => void;
  t: (pair: BilingualText) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  isRtl: false,
  setLang: () => {},
  toggleLang: () => {},
  t: (pair) => pair.en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('textprint_lang');
      if (saved === 'ar' || saved === 'en') return saved;
    }
    return 'en';
  });

  const isRtl = lang === 'ar';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    try {
      window.localStorage.setItem('textprint_lang', lang);
    } catch {
      // Ignore storage restrictions
    }
  }, [lang, isRtl]);

  const setLang = (next: Language) => setLangState(next);
  const toggleLang = () => setLangState((prev) => (prev === 'en' ? 'ar' : 'en'));
  const t = (pair: BilingualText) => pickText(lang, pair);

  return (
    <I18nContext.Provider value={{ lang, isRtl, setLang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
