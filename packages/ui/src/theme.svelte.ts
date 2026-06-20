// Theme state for the admin. The effective theme is applied to <html> as a
// `data-theme` attribute. A blocking script in app.html sets it before first
// paint (see THEME_INIT_SCRIPT) so there is no flash; this module then mirrors
// that state into a rune and lets the header toggle flip it.

const STORAGE_KEY = 'fs-admin-theme';

export type EffectiveTheme = 'light' | 'dark';
type ThemePreference = EffectiveTheme | 'system';

// Inline this in <head> (before stylesheets) to resolve the theme pre-paint.
// Kept as a string so apps can drop it into their app.html without importing
// the runtime. Mirrors the resolution logic below.
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}')||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=p==='system'?(d?'dark':'light'):p;var e=document.documentElement;e.setAttribute('data-theme',t);e.style.colorScheme=t;}catch(_){document.documentElement.setAttribute('data-theme','light');}})();`;

function systemTheme(): EffectiveTheme {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function storedPreference(): ThemePreference {
	if (typeof localStorage === 'undefined') return 'system';
	const value = localStorage.getItem(STORAGE_KEY);
	return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function applyTheme(value: EffectiveTheme) {
	const el = document.documentElement;
	el.setAttribute('data-theme', value);
	el.style.colorScheme = value;
}

// Shared reactive state. Components read `theme.current`.
export const theme = $state<{ current: EffectiveTheme }>({ current: 'light' });

let initialized = false;

// Call once on mount (client only). Seeds the rune from the attribute the
// blocking script already set, and keeps following the OS while the stored
// preference is "system".
export function initTheme() {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;
	const attr = document.documentElement.getAttribute('data-theme');
	theme.current = attr === 'dark' ? 'dark' : 'light';

	const media = window.matchMedia('(prefers-color-scheme: dark)');
	media.addEventListener('change', () => {
		if (storedPreference() !== 'system') return;
		const next = systemTheme();
		theme.current = next;
		applyTheme(next);
	});
}

export function toggleTheme() {
	const next: EffectiveTheme = theme.current === 'dark' ? 'light' : 'dark';
	theme.current = next;
	applyTheme(next);
	try {
		localStorage.setItem(STORAGE_KEY, next);
	} catch {
		// Ignore storage failures (private mode, disabled) — the in-memory
		// state still drives the UI for this session.
	}
}
