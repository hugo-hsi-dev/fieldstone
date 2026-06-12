<script lang="ts">
	import type { CollectionDocument, CollectionRuntimeConfig, CollectionSlug } from '@fieldstone/core';

	import FieldInput from './FieldInput.svelte';
	import { getFieldValue } from './labels';

	let {
		collection,
		collectionName,
		document,
		oncancel,
		onupdate
	}: {
		collection: CollectionRuntimeConfig;
		collectionName: string;
		document: CollectionDocument<CollectionSlug>;
		oncancel: () => void;
		onupdate: (event: SubmitEvent, collection: string) => void | Promise<void>;
	} = $props();
</script>

<form class="fs-admin__form" onsubmit={(event) => onupdate(event, collectionName)}>
	{#each collection.fields as field (field.name)}
		<FieldInput
			{field}
			id={`${field.name}-${document.id}`}
			value={getFieldValue(document, field.name)}
			compact
		/>
	{/each}
	<div class="fs-admin__actions">
		<button class="fs-admin__button fs-admin__button--primary">Save</button>
		<button class="fs-admin__button" type="button" onclick={oncancel}>Cancel</button>
	</div>
</form>

<style>
	.fs-admin__form {
		display: grid;
		gap: 1rem;
	}

	.fs-admin__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
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
