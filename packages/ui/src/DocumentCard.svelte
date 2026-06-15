<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		CollectionDocument,
		CollectionRuntimeConfig,
		CollectionSlug
	} from '@fieldstone/schema';

	import { getFieldValue } from './labels';
	import Button from './primitives/Button.svelte';
	import {
		adminDocumentPath,
		adminEditDocumentPath,
		adminRouteId,
		adminRouteSegments
	} from '@fieldstone/routes';

	let {
		collection,
		document
	}: {
		collection: CollectionRuntimeConfig;
		document: CollectionDocument<CollectionSlug>;
	} = $props();

	const titleField = $derived(collection.fields[0]?.name ?? 'id');

	function resolveAdminPath(path: string) {
		return resolve(adminRouteId, { segments: adminRouteSegments(path) });
	}
</script>

<article class="fs-admin__panel">
	<div class="fs-admin__document">
		<div class="fs-admin__document-body">
			<a
				class="fs-admin__document-title"
				href={resolveAdminPath(adminDocumentPath(collection.slug, document.id))}
			>
				{getFieldValue(document, titleField)}
			</a>
			{#each collection.fields.slice(1, 3) as field (field.name)}
				<p class="fs-admin__document-text">
					{getFieldValue(document, field.name)}
				</p>
			{/each}
		</div>
		<div class="fs-admin__actions">
			<Button href={resolveAdminPath(adminDocumentPath(collection.slug, document.id))}>View</Button>
			<Button href={resolveAdminPath(adminEditDocumentPath(collection.slug, document.id))}
				>Edit</Button
			>
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
