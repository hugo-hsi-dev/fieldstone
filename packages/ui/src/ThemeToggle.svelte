<script lang="ts">
	import { onMount } from 'svelte';
	import { Moon, Sun } from '@lucide/svelte';

	type FieldstoneTheme = 'light' | 'dark';

	const STORAGE_KEY = 'fieldstone-theme';

	let theme = $state<FieldstoneTheme>('light');

	function systemTheme(): FieldstoneTheme {
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	function storedTheme(): FieldstoneTheme | undefined {
		const value = window.localStorage.getItem(STORAGE_KEY);
		return value === 'light' || value === 'dark' ? value : undefined;
	}

	function applyTheme(nextTheme: FieldstoneTheme = storedTheme() ?? systemTheme()) {
		document.documentElement.classList.toggle('dark', nextTheme === 'dark');
		document.documentElement.dataset.theme = nextTheme;
		return nextTheme;
	}

	onMount(() => {
		theme = applyTheme();
	});

	const isDark = $derived(theme === 'dark');
	const label = $derived(isDark ? 'Switch to light theme' : 'Switch to dark theme');

	function toggleTheme() {
		const nextTheme = isDark ? 'light' : 'dark';
		window.localStorage.setItem(STORAGE_KEY, nextTheme);
		theme = applyTheme(nextTheme);
	}
</script>

<button
	type="button"
	class="fs-admin__button fs-admin__button--ghost fs-admin__button--icon"
	aria-label={label}
	aria-pressed={isDark}
	title={label}
	onclick={toggleTheme}
>
	{#if isDark}
		<Moon size={18} class="fs-admin__icon" aria-hidden="true" focusable="false" />
	{:else}
		<Sun size={18} class="fs-admin__icon" aria-hidden="true" focusable="false" />
	{/if}
</button>
