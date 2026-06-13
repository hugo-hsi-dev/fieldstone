<script lang="ts">
	import type { CollectionDocument, CollectionRuntimeConfig, CollectionSlug } from '@fieldstone/schema';

	import DocumentCard from './DocumentCard.svelte';
	import { getCollectionLabel } from './labels';

	let {
		collection,
		documents
	}: {
		collection: CollectionRuntimeConfig;
		documents: CollectionDocument<CollectionSlug>[];
	} = $props();
</script>

{#each documents as document (document.id)}
	<DocumentCard {collection} {document} />
{:else}
	<div class="fs-admin__empty">No {getCollectionLabel(collection, 'plural').toLowerCase()} yet.</div>
{/each}

<style>
	.fs-admin__empty {
		border: 1px dashed var(--fs-admin-border);
		border-radius: 0.5rem;
		background: var(--fs-admin-panel);
		padding: 2rem;
		text-align: center;
		color: var(--fs-admin-muted);
		font-size: 0.875rem;
	}
</style>
