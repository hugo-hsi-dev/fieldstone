<script lang="ts">
	import type { CollectionRuntimeConfig } from '@fieldstone/core';

	import { getFieldLabel, shouldUseTextarea } from './labels';

	let {
		field,
		id,
		value = '',
		compact = false,
		formField
	}: {
		field: CollectionRuntimeConfig['fields'][number];
		formField: {
			as: (type: 'text', value?: string) => Record<string, unknown>;
			issues: () => { message: string }[] | undefined;
		};
		id: string;
		value?: string | null;
		compact?: boolean;
	} = $props();
</script>

<div class="fs-admin__field">
	<label class="fs-admin__label" for={id}>{getFieldLabel(field)}</label>
	{#if shouldUseTextarea(field)}
		<textarea
			class={['fs-admin__textarea', compact && 'fs-admin__textarea--compact']}
			{...formField.as('text', value ?? '')}
			{id}
			required={field.required}
		></textarea>
	{:else}
		<input
			class="fs-admin__input"
			{...formField.as('text', value ?? '')}
			{id}
			required={field.required}
		/>
	{/if}
	{#each formField.issues() ?? [] as issue, index (`${issue.message}-${index}`)}
		<p class="fs-admin__field-error">{issue.message}</p>
	{/each}
</div>

<style>
	.fs-admin__field {
		display: grid;
		gap: 0.5rem;
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

	.fs-admin__field-error {
		margin: 0;
		color: var(--fs-admin-danger);
		font-size: 0.8125rem;
	}
</style>
