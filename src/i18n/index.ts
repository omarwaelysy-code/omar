import { ar } from './translations/ar';
import { en } from './translations/en';

export const translations = {
  ar,
  en
};

export type Language = keyof typeof translations;
export type TranslationKeys = keyof typeof ar;
