<script lang="ts">
	import type { CollectionRuntimeConfig } from '@fieldstone/schema';

	import FieldInput from './FieldInput.svelte';
	import { getCollectionLabel } from './labels';
	import Button from './primitives/Button.svelte';

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

	function hasFieldIssues() {
		return collection.fields.some((field) => {
			return (form.fields.data[field.identifier]?.issues() ?? []).length > 0;
		});
	}
</script>

<form class="fs-admin__panel fs-admin__form" {...form}>
	<input {...form.fields.collection.as('hidden', collection.slug)} />

	{#if !hasFieldIssues()}
		{#each form.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
			<p class="fs-admin__error">{issue.message}</p>
		{/each}
	{/if}

	{#each collection.fields as field (field.name)}
		<FieldInput
			{field}
			formField={form.fields.data[field.identifier]}
			id={`create-${collection.slug}-${field.identifier}`}
		/>
	{/each}

	<Button variant="primary" disabled={Boolean(form.pending)}>
		Create {getCollectionLabel(collection, 'singular').toLowerCase()}
	</Button>
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

	.fs-admin__error {
		border: 1px solid var(--fs-admin-danger-border);
		border-radius: 0.5rem;
		background: var(--fs-admin-danger-bg);
		color: var(--fs-admin-danger);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}
</style>
