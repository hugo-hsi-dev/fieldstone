<script lang="ts">
	import type { CollectionRuntimeConfig } from '@fieldstone/core';

	import { getFieldLabel, shouldUseTextarea } from './labels';

	let {
		field,
		id,
		value = '',
		compact = false
	}: {
		field: CollectionRuntimeConfig['fields'][number];
		id: string;
		value?: string;
		compact?: boolean;
	} = $props();
</script>

<div class="fs-admin__field">
	<label class="fs-admin__label" for={id}>{getFieldLabel(field)}</label>
	{#if shouldUseTextarea(field)}
		<textarea
			class={['fs-admin__textarea', compact && 'fs-admin__textarea--compact']}
			{id}
			name={field.name}
			required={field.required}
			{value}
		></textarea>
	{:else}
		<input
			class="fs-admin__input"
			{id}
			name={field.name}
			required={field.required}
			{value}
		/>
	{/if}
</div>

<style>
	.fs-admin__field {
		display: grid;
		gap: 1rem;
	}

	.fs-admin__label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.fs-admin__input,
	.fs-admin__textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--fs-admin-border-strong);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		font: inherit;
		font-size: 0.875rem;
		color: var(--fs-admin-text);
		background: var(--fs-admin-panel);
	}

	.fs-admin__input:focus,
	.fs-admin__textarea:focus {
		border-color: var(--fs-admin-primary);
		outline: none;
	}

	.fs-admin__textarea {
		min-height: 8rem;
		resize: vertical;
	}

	.fs-admin__textarea--compact {
		min-height: 7rem;
	}
</style>
