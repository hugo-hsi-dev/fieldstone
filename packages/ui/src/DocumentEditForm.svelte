<script lang="ts">
	import { base } from '$app/paths';
	import type { CollectionDocument, CollectionRuntimeConfig, CollectionSlug } from '@fieldstone/schema';

	import FieldInput from './FieldInput.svelte';
	import { getCollectionLabel, getFieldValue } from './labels';
	import { adminDocumentPath } from '@fieldstone/routes';

	type RemoteForm = {
		fields: Record<string, any>;
		pending?: number;
	};

	let {
		collection,
		document,
		form
	}: {
		collection: CollectionRuntimeConfig;
		document: CollectionDocument<CollectionSlug>;
		form: RemoteForm;
	} = $props();

	function hasFieldIssues() {
		return collection.fields.some((field) => {
			return (form.fields.data[field.identifier]?.issues() ?? []).length > 0;
		});
	}
</script>

<form class="fs-admin__panel fs-admin__form" {...form}>
	<input {...form.fields.collection.as('hidden', collection.slug)} />
	<input {...form.fields.id.as('hidden', document.id)} />

	{#if !hasFieldIssues()}
		{#each form.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
			<p class="fs-admin__error">{issue.message}</p>
		{/each}
	{/if}

	{#each collection.fields as field (field.name)}
		<FieldInput
			{field}
			formField={form.fields.data[field.identifier]}
			id={`edit-${document.id}-${field.identifier}`}
			value={getFieldValue(document, field.name)}
			compact
		/>
	{/each}

	<div class="fs-admin__actions">
		<button class="fs-admin__button fs-admin__button--primary" disabled={Boolean(form.pending)}>
			Save {getCollectionLabel(collection, 'singular').toLowerCase()}
		</button>
		<a class="fs-admin__button" href={adminDocumentPath(collection.slug, document.id, base)}>Cancel</a>
	</div>
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

	.fs-admin__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.fs-admin__button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--fs-admin-border-strong);
		border-radius: 0.375rem;
		background: var(--fs-admin-panel);
		color: var(--fs-admin-text);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
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
