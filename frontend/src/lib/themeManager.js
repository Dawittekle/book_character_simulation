/**
 * Lorely Application Theme Manager
 * Manages light/dark/system mode, brand accents, and accessibility settings.
 * Persists to localStorage and syncs with document.documentElement.
 */

export const ACCENT_COLORS = [
  { id: 'coral', name: 'Coral', desc: 'Signature', hex: '#e05a47', hover: '#c94a38' },
  { id: 'amber', name: 'Amber', desc: 'Scholar', hex: '#d97706', hover: '#b45309' },
  { id: 'emerald', name: 'Emerald', desc: 'Library', hex: '#059669', hover: '#047857' },
  { id: 'indigo', name: 'Indigo', desc: 'Nocturne', hex: '#4f46e5', hover: '#4338ca' },
];

export function applyAppTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const mode = theme || 'light';
  const isDark =
    mode === 'dark' ||
    (mode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.setAttribute('data-theme-setting', mode);
  if (isDark) {
    root.setAttribute('data-theme', 'dark');
    root.classList.add('dark');
  } else {
    root.setAttribute('data-theme', 'light');
    root.classList.remove('dark');
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lorely_app_theme', mode);
    }
  } catch (e) {
    // Ignore localStorage failures
  }
}

export function applyAccentColor(accentId) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const accent = ACCENT_COLORS.find((a) => a.id === accentId) || ACCENT_COLORS[0];
  root.setAttribute('data-accent', accent.id);
  root.style.setProperty('--lorely-settings-accent', accent.hex);
  root.style.setProperty('--lorely-settings-accent-hover', accent.hover);
  root.style.setProperty('--brand-orange', accent.hex);
  root.style.setProperty('--brand-orange-hover', accent.hover);
  root.style.setProperty('--brand-orange-soft', `${accent.hex}14`);
  root.style.setProperty('--brand-orange-border', `${accent.hex}40`);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lorely_accent_color', accent.id);
    }
  } catch (e) {
    // Ignore localStorage failures
  }
}

export function applyHighContrast(enabled) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isHighContrast = Boolean(enabled);
  root.setAttribute('data-high-contrast', String(isHighContrast));

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lorely_high_contrast', String(isHighContrast));
    }
  } catch (e) {
    // Ignore localStorage failures
  }
}

export function applyReducedMotion(enabled) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isReducedMotion = Boolean(enabled);
  root.setAttribute('data-reduced-motion', String(isReducedMotion));

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lorely_reduced_motion', String(isReducedMotion));
    }
  } catch (e) {
    // Ignore localStorage failures
  }
}

let mediaQueryListenerAttached = false;

function setupSystemThemeListener() {
  if (typeof window === 'undefined' || !window.matchMedia || mediaQueryListenerAttached) return;
  try {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const currentSetting = localStorage.getItem('lorely_app_theme');
      if (currentSetting === 'system') {
        applyAppTheme('system');
      }
    };
    if (mql.addEventListener) {
      mql.addEventListener('change', handleChange);
    } else if (mql.addListener) {
      mql.addListener(handleChange);
    }
    mediaQueryListenerAttached = true;
  } catch (e) {
    // Ignore matchMedia listener failure
  }
}

export function initThemePreferences() {
  if (typeof window === 'undefined') return;
  try {
    const savedTheme = localStorage.getItem('lorely_app_theme') || 'light';
    const savedAccent = localStorage.getItem('lorely_accent_color') || 'coral';
    const savedHighContrast = localStorage.getItem('lorely_high_contrast') === 'true';
    const savedReducedMotion = localStorage.getItem('lorely_reduced_motion') === 'true';

    applyAppTheme(savedTheme);
    applyAccentColor(savedAccent);
    applyHighContrast(savedHighContrast);
    applyReducedMotion(savedReducedMotion);
    setupSystemThemeListener();
  } catch (e) {
    console.debug('Failed initializing theme preferences:', e);
  }
}
