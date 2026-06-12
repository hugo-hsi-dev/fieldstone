<script lang="ts">
	import type { CollectionDocument, CollectionRuntimeConfig, CollectionSlug } from '@fieldstone/core';

	import { getFieldValue } from './labels';
	import { adminDocumentPath, adminEditDocumentPath } from './route';

	let {
		collection,
		document
	}: {
		collection: CollectionRuntimeConfig;
		document: CollectionDocument<CollectionSlug>;
	} = $props();

	const titleField = $derived(collection.fields[0]?.name ?? 'id');
</script>

<article class="fs-admin__panel">
	<div class="fs-admin__document">
		<div class="fs-admin__document-body">
			<a class="fs-admin__document-title" href={adminDocumentPath(collection.slug, document.id)}>
				{getFieldValue(document, titleField)}
			</a>
			{#each collection.fields.slice(1, 3) as field (field.name)}
				<p class="fs-admin__document-text">
					{getFieldValue(document, field.name)}
				</p>
			{/each}
		</div>
		<div class="fs-admin__actions">
			<a class="fs-admin__button" href={adminDocumentPath(collection.slug, document.id)}>View</a>
			<a class="fs-admin__button" href={adminEditDocumentPath(collection.slug, document.id)}>Edit</a>
		</div>
	</div>
</article>

<style>
	.fs-admin__panel {
		border: 1px solid var(--fs-admin-border);
		border-radius: 0.5rem;
		background: var(--fs-admin-panel);
		padding: 1rem;
	}

	.fs-admin__document {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.fs-admin__document-body {
		min-width: 0;
	}

	.fs-admin__document-title {
		display: inline-block;
		margin: 0;
		overflow-wrap: anywhere;
		color: var(--fs-admin-text);
		font-size: 1.125rem;
		line-height: 1.5rem;
		font-weight: 600;
		text-decoration: none;
	}

	.fs-admin__document-title:hover {
		text-decoration: underline;
		text-underline-offset: 0.25rem;
	}

	.fs-admin__document-text {
		margin: 0.5rem 0 0;
		overflow-wrap: anywhere;
		color: var(--fs-admin-muted);
		font-size: 0.875rem;
		line-height: 1.5rem;
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

	@media (min-width: 1024px) {
		.fs-admin__document {
			flex-direction: row;
			align-items: flex-start;
			justify-content: space-between;
		}

		.fs-admin__actions {
			flex-shrink: 0;
		}
	}
</style>
