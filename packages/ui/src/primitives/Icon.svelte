<script lang="ts">
	// Small inline-SVG icon set (Lucide-style, currentColor, stroke-based).
	// Decorative by default (aria-hidden); pass an `title` for a labelled icon.
	type IconName =
		| 'collection'
		| 'globe'
		| 'search'
		| 'sun'
		| 'moon'
		| 'menu'
		| 'arrow-left'
		| 'inbox'
		| 'alert'
		| 'plus'
		| 'close'
		| 'edit'
		| 'chevron-right';

	let {
		name,
		size = 16,
		title,
		class: className = ''
	}: {
		name: IconName;
		size?: number;
		title?: string;
		class?: string;
	} = $props();
</script>

<svg
	class={['fs-admin__icon', className]}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	role={title ? 'img' : undefined}
	aria-hidden={title ? undefined : 'true'}
	aria-label={title}
>
	{#if title}<title>{title}</title>{/if}
	{#if name === 'collection'}
		<path
			d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"
		/>
		<path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
		<path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
	{:else if name === 'globe'}
		<circle cx="12" cy="12" r="10" />
		<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
		<path d="M2 12h20" />
	{:else if name === 'search'}
		<circle cx="11" cy="11" r="8" />
		<path d="m21 21-4.3-4.3" />
	{:else if name === 'sun'}
		<circle cx="12" cy="12" r="4" />
		<path
			d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
		/>
	{:else if name === 'moon'}
		<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
	{:else if name === 'menu'}
		<path d="M4 6h16M4 12h16M4 18h16" />
	{:else if name === 'arrow-left'}
		<path d="m12 19-7-7 7-7" />
		<path d="M19 12H5" />
	{:else if name === 'inbox'}
		<path d="M22 12h-6l-2 3h-4l-2-3H2" />
		<path
			d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"
		/>
	{:else if name === 'alert'}
		<circle cx="12" cy="12" r="10" />
		<path d="M12 8v4M12 16h.01" />
	{:else if name === 'plus'}
		<path d="M5 12h14M12 5v14" />
	{:else if name === 'close'}
		<path d="M18 6 6 18M6 6l12 12" />
	{:else if name === 'edit'}
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
	{:else if name === 'chevron-right'}
		<path d="m9 18 6-6-6-6" />
	{/if}
</svg>

<style>
	.fs-admin__icon {
		display: block;
		flex-shrink: 0;
	}
</style>
