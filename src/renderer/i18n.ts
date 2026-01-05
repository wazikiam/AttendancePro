import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import enTranslation from '../shared/locales/en/translation.json';

// Define resources
const resources = {
  en: {
    translation: enTranslation
  },
  ar: {
    translation: {} // Empty for now, will add Arabic translations later
  },
  fr: {
    translation: {} // Empty for now, will add French translations later
  }
};

// Language direction configuration
const languageDirections: Record<string, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
  fr: 'ltr'
};

// i18n configuration
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default language
    fallbackLng: 'en',
    
    interpolation: {
      escapeValue: false // React already safes from XSS
    },
    
    react: {
      useSuspense: false // Set to true if using Suspense
    }
  });

// Helper to get current language direction
export const getLanguageDirection = (): 'ltr' | 'rtl' => {
  const lang = i18n.language.split('-')[0]; // Get base language code
  return languageDirections[lang] || 'ltr';
};

// Helper to change language with direction update
export const changeLanguageWithDirection = async (lng: string): Promise<void> => {
  await i18n.changeLanguage(lng);
  const dir = getLanguageDirection();
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
  
  // Update CSS for RTL if needed
  if (dir === 'rtl') {
    document.documentElement.classList.add('rtl');
  } else {
    document.documentElement.classList.remove('rtl');
  }
};

// Set initial direction
const initialDir = getLanguageDirection();
document.documentElement.dir = initialDir;
document.documentElement.lang = i18n.language;

if (initialDir === 'rtl') {
  document.documentElement.classList.add('rtl');
}

export default i18n;