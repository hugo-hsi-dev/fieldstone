<script lang="ts">
	import type { CollectionRuntimeConfig } from '@fieldstone/schema';

	import { getFieldLabel, shouldUseTextarea } from './labels';
	import Label from './primitives/Label.svelte';

	let {
		field,
		id,
		value = undefined,
		compact = false,
		formField
	}: {
		field: CollectionRuntimeConfig['fields'][number];
		formField: {
			as: (type: 'checkbox' | 'hidden' | 'text', value?: string) => Record<string, unknown>;
			issues: () => { message: string }[] | undefined;
		};
		id: string;
		value?: boolean | string | null;
		compact?: boolean;
	} = $props();
</script>

<div class="fs-admin__field">
	<Label for={id}>{getFieldLabel(field)}</Label>
	{#if field.type === 'boolean'}
		<input {...formField.as('hidden', 'false')} />
		<input
			class="fs-admin__checkbox"
			checked={value === true}
			{...formField.as('checkbox', 'true')}
			{id}
		/>
	{:else if shouldUseTextarea(field)}
		<textarea
			class={['fs-admin__textarea', compact && 'fs-admin__textarea--compact']}
			{...formField.as('text', String(value ?? ''))}
			{id}
		></textarea>
	{:else}
		<input class="fs-admin__input" {...formField.as('text', String(value ?? ''))} {id} />
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

	.fs-admin__checkbox {
		width: 1rem;
		height: 1rem;
		accent-color: var(--fs-admin-primary);
	}

	.fs-admin__field-error {
		margin: 0;
		color: var(--fs-admin-danger);
		font-size: 0.8125rem;
	}
</style>
