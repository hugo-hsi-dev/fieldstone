<script lang="ts">
	import { Button as BitsButton } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = '',
		variant,
		...rest
	}: {
		children?: Snippet;
		class?: string;
		variant?: 'default' | 'primary' | 'danger';
		[key: string]: unknown;
	} = $props();
</script>

<BitsButton.Root
	class={[
		'fs-admin__button',
		variant === 'primary' && 'fs-admin__button--primary',
		variant === 'danger' && 'fs-admin__button--danger',
		className
	]}
	{...rest}
>
	{@render children?.()}
</BitsButton.Root>

<style>
	:global(.fs-admin__button) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-height: 2.5rem;
		border: 1px solid var(--fs-admin-border-strong);
		border-radius: 0.375rem;
		background: var(--fs-admin-panel);
		color: var(--fs-admin-text);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
	}

	:global(.fs-admin__button:hover) {
		background: #f4f4f5;
	}

	:global(.fs-admin__button--primary) {
		border-color: var(--fs-admin-primary);
		background: var(--fs-admin-primary);
		color: white;
	}

	:global(.fs-admin__button--primary:hover) {
		background: var(--fs-admin-primary-hover);
	}

	:global(.fs-admin__button--danger) {
		border-color: var(--fs-admin-danger-border);
		color: var(--fs-admin-danger);
	}

	:global(.fs-admin__button--danger:hover) {
		background: var(--fs-admin-danger-bg);
	}

	:global(.fs-admin__button:disabled) {
		opacity: 0.55;
	}
</style>
