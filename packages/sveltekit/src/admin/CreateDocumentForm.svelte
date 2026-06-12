<script lang="ts">
	import type { CollectionRuntimeConfig } from '@fieldstone/core';

	import FieldInput from './FieldInput.svelte';
	import { getCollectionLabel } from './labels';

	let {
		collection,
		oncreate
	}: {
		collection: CollectionRuntimeConfig;
		oncreate: (event: SubmitEvent, collection: CollectionRuntimeConfig) => void | Promise<void>;
	} = $props();
</script>

<form class="fs-admin__panel fs-admin__form" onsubmit={(event) => oncreate(event, collection)}>
	{#each collection.fields as field (field.name)}
		<FieldInput {field} id={field.name} />
	{/each}

	<button class="fs-admin__button fs-admin__button--primary">
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
</style>
