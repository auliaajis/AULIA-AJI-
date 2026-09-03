// Global Theme Management Utility for BK Application
export const THEME_STORAGE_KEY = 'bk_dark_mode';

export function getIsDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved !== null) {
    return saved === 'true';
  }
  // Check system preference if no user preference is saved
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function setDarkMode(enable: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, enable ? 'true' : 'false');
  applyTheme(enable);
  window.dispatchEvent(new CustomEvent('bk_theme_changed', { detail: { isDarkMode: enable } }));
}

export function toggleDarkMode(): boolean {
  const nextState = !getIsDarkMode();
  setDarkMode(nextState);
  return nextState;
}

export function applyTheme(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    document.body.classList.add('dark-mode');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    document.body.classList.remove('dark-mode');
  }
}

// Auto initialize theme on module load
if (typeof window !== 'undefined') {
  applyTheme(getIsDarkMode());
}
