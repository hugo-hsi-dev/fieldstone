<script lang="ts">
	import type { Component } from 'svelte';
	import {
		ArrowLeft,
		ChevronRight,
		CircleAlert,
		Globe,
		Inbox,
		Layers,
		Menu,
		Moon,
		Pencil,
		Plus,
		Search,
		Sun,
		X
	} from '@lucide/svelte';

	// Thin wrapper over @lucide/svelte so call-sites keep a stable `name` API.
	// Decorative by default (aria-hidden); pass `title` for a labelled icon.
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

	const ICONS: Record<IconName, Component> = {
		collection: Layers,
		globe: Globe,
		search: Search,
		sun: Sun,
		moon: Moon,
		menu: Menu,
		'arrow-left': ArrowLeft,
		inbox: Inbox,
		alert: CircleAlert,
		plus: Plus,
		close: X,
		edit: Pencil,
		'chevron-right': ChevronRight
	};

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

	const Glyph = $derived(ICONS[name]);
	const cls = $derived(['fs-admin__icon', className].filter(Boolean).join(' '));
</script>

{#if title}
	<Glyph {size} class={cls} role="img" aria-label={title} />
{:else}
	<Glyph {size} class={cls} aria-hidden="true" focusable="false" />
{/if}

<style>
	:global(.fs-admin__icon) {
		display: block;
		flex-shrink: 0;
	}
</style>
