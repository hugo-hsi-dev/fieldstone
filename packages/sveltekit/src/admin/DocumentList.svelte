<script lang="ts">
	import type { CollectionDocument, CollectionRuntimeConfig, CollectionSlug } from '@fieldstone/core';

	import DocumentCard from './DocumentCard.svelte';
	import { getCollectionLabel } from './labels';

	let {
		collection,
		collectionName,
		documents,
		editingId,
		ondelete,
		onedit,
		onupdate,
		oncancel
	}: {
		collection: CollectionRuntimeConfig;
		collectionName: string;
		documents: CollectionDocument<CollectionSlug>[];
		editingId: string | null;
		ondelete: (collection: string, id: string) => void | Promise<void>;
		onedit: (collection: string, id: string) => void | Promise<void>;
		onupdate: (event: SubmitEvent, collection: string) => void | Promise<void>;
		oncancel: () => void;
	} = $props();
</script>

{#each documents as document (document.id)}
	<DocumentCard
		{collection}
		{collectionName}
		{document}
		editing={editingId === document.id}
		{oncancel}
		{ondelete}
		{onedit}
		{onupdate}
	/>
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
