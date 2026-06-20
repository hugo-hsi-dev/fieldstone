<script lang="ts">
	import { Button as BitsButton } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = '',
		variant = 'default',
		size = 'md',
		icon = false,
		...rest
	}: {
		children?: Snippet;
		class?: string;
		variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'danger-ghost';
		size?: 'sm' | 'md' | 'lg';
		icon?: boolean;
		[key: string]: unknown;
	} = $props();
</script>

<BitsButton.Root
	class={[
		'fs-admin__button',
		variant !== 'default' && `fs-admin__button--${variant}`,
		size !== 'md' && `fs-admin__button--${size}`,
		icon && 'fs-admin__button--icon',
		className
	]}
	{...rest}
>
	{@render children?.()}
</BitsButton.Root>
