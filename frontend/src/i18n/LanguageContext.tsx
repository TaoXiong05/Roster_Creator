import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { en } from './en';
import { zh } from './zh';

export type Language = 'en' | 'zh';

const DICTS = { en, zh };
const STORAGE_KEY = 'roster-creator-language';

function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars[name] ?? ''));
}

export function translate(language: Language, key: string, vars?: Record<string, string | number>): string {
  const value = lookup(DICTS[language], key) ?? lookup(DICTS.en, key);
  if (typeof value !== 'string') return key;
  return interpolate(value, vars);
}

export function getDictionary(language: Language) {
  return DICTS[language];
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const defaultValue: LanguageContextValue = {
  language: 'en',
  setLanguage: () => {},
  t: (key, vars) => translate('en', key, vars),
};

const LanguageContext = createContext<LanguageContextValue>(defaultValue);

function readStoredLanguage(): Language {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    typeof window === 'undefined' ? 'en' : readStoredLanguage()
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore storage errors (e.g. private browsing) — the in-memory state still works.
    }
  }, [language]);

  const value: LanguageContextValue = {
    language,
    setLanguage: setLanguageState,
    t: (key, vars) => translate(language, key, vars),
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
