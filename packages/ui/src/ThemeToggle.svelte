<script lang="ts">
	import { onMount } from 'svelte';
	import { mode, toggleMode } from 'mode-watcher';

	import Icon from './primitives/Icon.svelte';

	// `mode.current` is undefined during SSR; render a stable placeholder until
	// mounted so the server and first client render agree (no hydration mismatch).
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	const isDark = $derived(mounted && mode.current === 'dark');
	const label = $derived(isDark ? 'Switch to light theme' : 'Switch to dark theme');
</script>

<button
	type="button"
	class="fs-admin__button fs-admin__button--ghost fs-admin__button--icon"
	aria-label={label}
	aria-pressed={isDark}
	title={label}
	onclick={toggleMode}
>
	{#if isDark}
		<Icon name="moon" size={18} />
	{:else}
		<Icon name="sun" size={18} />
	{/if}
</button>
