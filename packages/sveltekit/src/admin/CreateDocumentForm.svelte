<script lang="ts">
	import type { CollectionRuntimeConfig } from '@fieldstone/core';

	import FieldInput from './FieldInput.svelte';
	import { getCollectionLabel } from './labels';

	type RemoteForm = {
		fields: Record<string, any>;
		pending?: number;
	};

	let {
		collection,
		form
	}: {
		collection: CollectionRuntimeConfig;
		form: RemoteForm;
	} = $props();
</script>

<form class="fs-admin__panel fs-admin__form" {...form}>
	<input {...form.fields.collection.as('hidden', collection.slug)} />

	{#each form.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
		<p class="fs-admin__error">{issue.message}</p>
	{/each}

	{#each collection.fields as field (field.name)}
		<FieldInput
			{field}
			formField={form.fields.data[field.identifier]}
			id={`create-${collection.slug}-${field.identifier}`}
		/>
	{/each}

	<button class="fs-admin__button fs-admin__button--primary" disabled={Boolean(form.pending)}>
		Create {getCollectionLabel(collection, 'singular').toLowerCase()}
	</button>
</form>

<style>
	.fs-admin__form {
		display: grid;
		gap: 1rem;
	}

	.fs-admin__panel {
		border: 1px solid var(--fs-admin-border);
		border-radius: 0.5rem;
		background: var(--fs-admin-panel);
		padding: 1rem;
	}

	.fs-admin__button {
		border: 1px solid var(--fs-admin-border-strong);
		border-radius: 0.375rem;
		background: var(--fs-admin-panel);
		color: var(--fs-admin-text);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.fs-admin__button:hover {
		background: #f4f4f5;
	}

	.fs-admin__button--primary {
		border-color: var(--fs-admin-primary);
		background: var(--fs-admin-primary);
		color: white;
	}

	.fs-admin__button--primary:hover {
		background: var(--fs-admin-primary-hover);
	}

	.fs-admin__button:disabled {
		opacity: 0.55;
	}

	.fs-admin__error {
		border: 1px solid var(--fs-admin-danger-border);
		border-radius: 0.5rem;
		background: var(--fs-admin-danger-bg);
		color: var(--fs-admin-danger);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}
</style>
