import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
  },
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en'],
  interpolation: { escapeValue: false },
});

export default i18next;
