<script lang="ts">
	import { Label as BitsLabel } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = '',
		...rest
	}: {
		children?: Snippet;
		class?: string;
		[key: string]: unknown;
	} = $props();
</script>

<BitsLabel.Root class={['fs-admin__label', className]} {...rest}>
	{@render children?.()}
</BitsLabel.Root>

<style>
	:global(.fs-admin__label) {
		font-size: 0.875rem;
		font-weight: 500;
	}
</style>
