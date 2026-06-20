<script lang="ts">
	import { Label as BitsLabel } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = '',
		required = false,
		...rest
	}: {
		children?: Snippet;
		class?: string;
		required?: boolean;
		[key: string]: unknown;
	} = $props();
</script>

<BitsLabel.Root
	class={['fs-admin__label', required && 'fs-admin__label--required', className]}
	{...rest}
>
	{@render children?.()}
</BitsLabel.Root>
