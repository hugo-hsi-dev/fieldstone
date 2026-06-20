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

<BitsLabel.Root class={['fs-admin__label', className]} {...rest}>
	{@render children?.()}
	{#if required}
		<!-- aria-hidden so the marker is excluded from the control's accessible name -->
		<span class="fs-admin__required" aria-hidden="true">&nbsp;*</span>
	{/if}
</BitsLabel.Root>
