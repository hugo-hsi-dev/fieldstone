<script lang="ts">
	import { onMount } from 'svelte';

	import Icon from './primitives/Icon.svelte';
	import { initTheme, theme, toggleTheme } from './theme.svelte';

	// Seed the rune from the attribute the blocking app.html script set. Until
	// mounted, render a stable placeholder so SSR markup never assumes a theme
	// (avoids a hydration mismatch).
	let mounted = $state(false);
	onMount(() => {
		initTheme();
		mounted = true;
	});

	const isDark = $derived(theme.current === 'dark');
	const label = $derived(isDark ? 'Switch to light theme' : 'Switch to dark theme');
</script>

<button
	type="button"
	class="fs-admin__button fs-admin__button--ghost fs-admin__button--icon"
	aria-label={label}
	aria-pressed={isDark}
	title={label}
	onclick={toggleTheme}
>
	{#if mounted && isDark}
		<Icon name="moon" size={18} />
	{:else}
		<Icon name="sun" size={18} />
	{/if}
</button>
