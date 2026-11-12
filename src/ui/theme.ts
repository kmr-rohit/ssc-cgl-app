export function applyTheme(theme: 'auto' | 'light' | 'dark') {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
