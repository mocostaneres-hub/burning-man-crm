import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

const COOKIE_CONSENT_STORAGE_KEY = 'g8road.cookieConsent.v1';
const OPEN_COOKIE_PREFERENCES_EVENT = 'g8road:open-cookie-preferences';

const EEA_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'IS', 'LI', 'NO'
]);

const UK_AND_SWISS_CODES = new Set(['GB', 'CH']);

type CookieConsentPreferences = {
  essential: true;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
  updatedAt: string;
};

type CookieConsentContextValue = {
  consent: CookieConsentPreferences | null;
  canUseAnalytics: boolean;
  canUseFunctional: boolean;
  shouldShowConsent: boolean;
  openPreferences: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

const getRegionCodeFromLanguage = (): string | null => {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const locales = [navigator.language, ...(navigator.languages || [])].filter(Boolean);
  for (const locale of locales) {
    const normalized = String(locale).replace('_', '-');
    const parts = normalized.split('-');
    const region = parts.length > 1 ? parts[parts.length - 1] : null;
    if (region && region.length === 2) {
      return region.toUpperCase();
    }
  }
  return null;
};

const isLikelyEUUser = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const regionCode = getRegionCodeFromLanguage();
  if (regionCode && (EEA_COUNTRY_CODES.has(regionCode) || UK_AND_SWISS_CODES.has(regionCode))) {
    return true;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  return timezone.startsWith('Europe/');
};

const shouldShowConsentBanner = (): boolean => {
  const mode = (process.env.REACT_APP_COOKIE_CONSENT_MODE || 'eu').toLowerCase();
  if (mode === 'off') return false;
  if (mode === 'all') return true;
  return isLikelyEUUser();
};

const readStoredConsent = (): CookieConsentPreferences | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      essential: true,
      analytics: Boolean(parsed.analytics),
      functional: Boolean(parsed.functional),
      marketing: Boolean(parsed.marketing),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString()
    };
  } catch (error) {
    console.warn('[CookieConsent] Failed to parse stored preferences:', error);
    return null;
  }
};

const CookieConsentBanner: React.FC<{
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onCustomize: () => void;
}> = ({ onAcceptAll, onRejectAll, onCustomize }) => (
  <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-orange-200 bg-white/95 backdrop-blur p-4 shadow-2xl">
    <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-gray-700">
        <p className="font-semibold text-gray-900">Cookie preferences</p>
        <p>
          We use essential cookies to keep the site secure and optional cookies for analytics and
          third-party features. You can choose what you allow.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCustomize}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
        >
          Customize
        </button>
        <button
          type="button"
          onClick={onRejectAll}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
        >
          Reject all
        </button>
        <button
          type="button"
          onClick={onAcceptAll}
          className="rounded bg-custom-primary px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Accept all
        </button>
      </div>
    </div>
  </div>
);

const CookiePreferencesModal: React.FC<{
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
  onChange: (next: { analytics: boolean; functional: boolean; marketing: boolean }) => void;
  onClose: () => void;
  onRejectAll: () => void;
  onSave: () => void;
}> = ({ analytics, functional, marketing, onChange, onClose, onRejectAll, onSave }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
      <h2 className="text-xl font-semibold text-gray-900">Cookie preferences</h2>
      <p className="mt-2 text-sm text-gray-600">
        Essential cookies are always on. Use the options below to control optional categories.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-start justify-between gap-3 rounded border p-3">
          <span>
            <span className="block text-sm font-semibold text-gray-900">Essential</span>
            <span className="block text-xs text-gray-600">Required for security, login, and basic functionality.</span>
          </span>
          <input type="checkbox" checked disabled aria-label="Essential cookies are required" />
        </label>

        <label className="flex items-start justify-between gap-3 rounded border p-3">
          <span>
            <span className="block text-sm font-semibold text-gray-900">Analytics</span>
            <span className="block text-xs text-gray-600">Helps us understand traffic and improve the product.</span>
          </span>
          <input
            type="checkbox"
            checked={analytics}
            onChange={(e) => onChange({ analytics: e.target.checked, functional, marketing })}
            aria-label="Allow analytics cookies"
          />
        </label>

        <label className="flex items-start justify-between gap-3 rounded border p-3">
          <span>
            <span className="block text-sm font-semibold text-gray-900">Functional</span>
            <span className="block text-xs text-gray-600">Third-party features such as social/embed integrations.</span>
          </span>
          <input
            type="checkbox"
            checked={functional}
            onChange={(e) => onChange({ analytics, functional: e.target.checked, marketing })}
            aria-label="Allow functional cookies"
          />
        </label>

        <label className="flex items-start justify-between gap-3 rounded border p-3">
          <span>
            <span className="block text-sm font-semibold text-gray-900">Marketing</span>
            <span className="block text-xs text-gray-600">Personalization or advertising-related tracking.</span>
          </span>
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => onChange({ analytics, functional, marketing: e.target.checked })}
            aria-label="Allow marketing cookies"
          />
        </label>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onRejectAll}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
        >
          Reject all
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded bg-custom-primary px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Save preferences
        </button>
      </div>
    </div>
  </div>
);

export const CookieConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consent, setConsent] = useState<CookieConsentPreferences | null>(() => readStoredConsent());
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [draftPreferences, setDraftPreferences] = useState({
    analytics: consent?.analytics ?? false,
    functional: consent?.functional ?? false,
    marketing: consent?.marketing ?? false
  });

  const shouldShowConsent = useMemo(() => shouldShowConsentBanner(), []);

  useEffect(() => {
    if (!isPreferencesOpen) return;
    setDraftPreferences({
      analytics: consent?.analytics ?? false,
      functional: consent?.functional ?? false,
      marketing: consent?.marketing ?? false
    });
  }, [isPreferencesOpen, consent]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOpenPreferences = () => setIsPreferencesOpen(true);
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handleOpenPreferences);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handleOpenPreferences);
  }, []);

  const persistConsent = useCallback((next: Omit<CookieConsentPreferences, 'updatedAt' | 'essential'> & { essential?: true }) => {
    const normalized: CookieConsentPreferences = {
      essential: true,
      analytics: Boolean(next.analytics),
      functional: Boolean(next.functional),
      marketing: Boolean(next.marketing),
      updatedAt: new Date().toISOString()
    };
    setConsent(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(normalized));
    }
    setIsPreferencesOpen(false);
  }, []);

  const acceptAll = useCallback(() => {
    persistConsent({ analytics: true, functional: true, marketing: true });
  }, [persistConsent]);

  const rejectAll = useCallback(() => {
    persistConsent({ analytics: false, functional: false, marketing: false });
  }, [persistConsent]);

  const contextValue = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      canUseAnalytics: shouldShowConsent ? Boolean(consent?.analytics) : true,
      canUseFunctional: shouldShowConsent ? Boolean(consent?.functional) : true,
      shouldShowConsent,
      openPreferences: () => setIsPreferencesOpen(true)
    }),
    [consent, shouldShowConsent]
  );

  return (
    <CookieConsentContext.Provider value={contextValue}>
      {children}

      {shouldShowConsent && !consent && (
        <CookieConsentBanner
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onCustomize={() => setIsPreferencesOpen(true)}
        />
      )}

      {isPreferencesOpen && (
        <CookiePreferencesModal
          analytics={draftPreferences.analytics}
          functional={draftPreferences.functional}
          marketing={draftPreferences.marketing}
          onChange={setDraftPreferences}
          onClose={() => setIsPreferencesOpen(false)}
          onRejectAll={rejectAll}
          onSave={() => persistConsent(draftPreferences)}
        />
      )}
    </CookieConsentContext.Provider>
  );
};

export const useCookieConsent = (): CookieConsentContextValue => {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider');
  }
  return context;
};

export const COOKIE_PREFERENCES_EVENT = OPEN_COOKIE_PREFERENCES_EVENT;
