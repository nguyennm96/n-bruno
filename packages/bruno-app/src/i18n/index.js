import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import translationEn from './translation/en.json';
import translationVi from './translation/vi.json';

const resources = {
  en: {
    translation: translationEn
  },
  vi: {
    translation: translationVi
  }
};

// Read initial language from preferences injected by Electron before React boots.
// Falls back to 'en' if not set.
const initialLanguage = window.__PREFERENCES__?.general?.language || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,

    ns: 'translation',

    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
