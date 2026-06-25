<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = '',
		variant = 'default',
		size = 'md',
		icon = false,
		href,
		...rest
	}: {
		children?: Snippet;
		class?: string;
		variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'danger-ghost';
		size?: 'sm' | 'md' | 'lg';
		icon?: boolean;
		href?: string;
		[key: string]: unknown;
	} = $props();

	const classes = $derived([
		'fs-admin__button',
		variant !== 'default' && `fs-admin__button--${variant}`,
		size !== 'md' && `fs-admin__button--${size}`,
		icon && 'fs-admin__button--icon',
		className
	]);
</script>

{#if href}
	<a class={classes} {href} {...rest}>
		{@render children?.()}
	</a>
{:else}
	<button class={classes} {...rest}>
		{@render children?.()}
	</button>
{/if}
