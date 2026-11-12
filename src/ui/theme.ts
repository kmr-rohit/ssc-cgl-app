// Light is the default. Dark ("night study") only when chosen in Profile. Legacy 'auto' counts as light.
export function applyTheme(theme: 'auto' | 'light' | 'dark') {
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141d2f' : '#ffffff');
}
