<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		CollectionDocument,
		CollectionRuntimeConfig,
		CollectionSlug
	} from '@fieldstone/schema';
	import { UPLOAD_FIELD_NAMES } from '@fieldstone/schema';

	import { getCollectionLabel, getFieldLabel, getFieldValue } from './labels';
	import Button from './primitives/Button.svelte';
	import Icon from './primitives/Icon.svelte';
	import {
		adminDocumentPath,
		adminEditDocumentPath,
		adminRouteId,
		adminRouteSegments,
		mediaPath
	} from '@fieldstone/routes';

	let {
		collection,
		documents,
		search = ''
	}: {
		collection: CollectionRuntimeConfig;
		documents: CollectionDocument<CollectionSlug>[];
		search?: string;
	} = $props();

	// Media collections lead with a thumbnail and are titled by their filename
	// (the first user field, e.g. an optional `alt`, is often blank).
	const isUpload = $derived(Boolean(collection.upload));
	const titleField = $derived(isUpload ? 'filename' : (collection.fields[0]?.name ?? 'id'));

	function thumbUrl(document: CollectionDocument<CollectionSlug>): string | null {
		const mimeType = (document as { mimeType?: unknown }).mimeType;
		if (typeof mimeType === 'string' && !mimeType.startsWith('image/')) return null;
		// Prefer the configured adminThumbnail variant (smaller); fall back to the original.
		const adminThumbnail = collection.upload?.adminThumbnail;
		const sizes = (document as { sizes?: unknown }).sizes;
		if (adminThumbnail && Array.isArray(sizes)) {
			const variant = sizes.find(
				(entry) => (entry as { name?: unknown } | null)?.name === adminThumbnail
			) as { filename?: unknown } | undefined;
			if (typeof variant?.filename === 'string' && variant.filename)
				return mediaPath(variant.filename);
		}
		const filename = (document as { filename?: unknown }).filename;
		if (typeof filename !== 'string' || !filename) return null;
		return mediaPath(filename);
	}

	// Up to two scalar summary columns (skip the title field and anything that
	// renders as long/structured content — rich text, groups, arrays). Upload
	// collections title by `filename` (not field[0]), so they start at 0; and their
	// injected metadata (filename/mimeType/…) is hidden — it's noise in a list.
	const SUMMARY_TYPES = ['text', 'email', 'number', 'select', 'boolean', 'date'];
	const UPLOAD_METADATA = new Set<string>(UPLOAD_FIELD_NAMES);
	const summaryFields = $derived(
		collection.fields
			.slice(isUpload ? 0 : 1)
			.filter((field) => SUMMARY_TYPES.includes(field.type))
			.filter((field) => !isUpload || !UPLOAD_METADATA.has(field.name))
			.slice(0, 2)
	);

	function resolveAdminPath(path: string) {
		return resolve(adminRouteId, { segments: adminRouteSegments(path) });
	}

	function formatDate(value: unknown): string {
		if (!value) return '';
		const date = value instanceof Date ? value : new Date(String(value));
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function hasUpdated(document: CollectionDocument<CollectionSlug>): boolean {
		return 'updatedAt' in document && Boolean((document as { updatedAt?: unknown }).updatedAt);
	}
</script>

{#if documents.length}
	<div class="fs-admin__panel fs-admin__table-wrap">
		<table class="fs-admin__table">
			<thead>
				<tr>
					{#if isUpload}<th scope="col" class="fs-admin__th-thumb"
							><span class="fs-admin__sr-only">Preview</span></th
						>{/if}
					<th scope="col">Title</th>
					{#each summaryFields as field (field.name)}
						<th scope="col">{getFieldLabel(field)}</th>
					{/each}
					<th scope="col">Updated</th>
					<th scope="col" class="fs-admin__th-actions">
						<span class="fs-admin__sr-only">Actions</span>
					</th>
				</tr>
			</thead>
			<tbody>
				{#each documents as document (document.id)}
					<tr>
						{#if isUpload}{@const url = thumbUrl(document)}<td
								data-label="Preview"
								class="fs-admin__cell-thumb"
								>{#if url}<img
										class="fs-admin__list-thumb"
										src={url}
										alt=""
										loading="lazy"
									/>{/if}</td
							>{/if}
						<td data-label="Title" class="fs-admin__cell-title">
							<a
								class="fs-admin__doc-link"
								href={resolveAdminPath(adminDocumentPath(collection.slug, document.id))}
							>
								{getFieldValue(document, titleField)}
							</a>
						</td>
						{#each summaryFields as field (field.name)}
							<td data-label={getFieldLabel(field)} class="fs-admin__cell-muted">
								{getFieldValue(document, field.name)}
							</td>
						{/each}
						<td data-label="Updated" class="fs-admin__cell-muted fs-admin__cell-updated">
							{hasUpdated(document)
								? formatDate((document as { updatedAt?: unknown }).updatedAt)
								: ''}
						</td>
						<td class="fs-admin__cell-actions">
							<Button
								size="sm"
								variant="ghost"
								href={resolveAdminPath(adminEditDocumentPath(collection.slug, document.id))}
							>
								<Icon name="edit" />
								Edit
							</Button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if search}
	<div class="fs-admin__panel fs-admin__empty">
		<span class="fs-admin__empty-icon"><Icon name="search" size={20} /></span>
		<p class="fs-admin__empty-title">No results for “{search}”</p>
		<p class="fs-admin__empty-text">Try a different search term.</p>
	</div>
{:else}
	<div class="fs-admin__panel fs-admin__empty">
		<span class="fs-admin__empty-icon"><Icon name="inbox" size={20} /></span>
		<p class="fs-admin__empty-title">
			No {getCollectionLabel(collection, 'plural').toLowerCase()} yet
		</p>
		<p class="fs-admin__empty-text">
			Create your first {getCollectionLabel(collection, 'singular').toLowerCase()} to get started.
		</p>
	</div>
{/if}

<style>
	.fs-admin__table-wrap {
		overflow-x: auto;
		padding: 0;
	}

	.fs-admin__table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
	}

	.fs-admin__table thead th {
		background: var(--fs-admin-inset);
		color: var(--fs-admin-muted);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-align: left;
		white-space: nowrap;
		padding: 0 1rem;
		height: 2.5rem;
		border-bottom: 1px solid var(--fs-admin-border);
	}

	.fs-admin__th-actions {
		width: 1%;
	}

	.fs-admin__th-thumb,
	.fs-admin__cell-thumb {
		width: 3rem;
	}

	.fs-admin__list-thumb {
		display: block;
		width: 2.5rem;
		height: 2.5rem;
		object-fit: cover;
		border-radius: var(--fs-radius-sm);
		border: 1px solid var(--fs-admin-border);
	}

	.fs-admin__table tbody td {
		padding: 0 1rem;
		height: 3rem;
		border-top: 1px solid var(--fs-admin-border);
		color: var(--fs-admin-text);
		vertical-align: middle;
	}

	.fs-admin__table tbody tr:first-child td {
		border-top: none;
	}

	.fs-admin__table tbody tr {
		transition: background var(--fs-dur-fast) var(--fs-ease);
	}

	.fs-admin__table tbody tr:hover {
		background: var(--fs-admin-hover);
	}

	.fs-admin__cell-muted {
		color: var(--fs-admin-muted);
		max-width: 18rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fs-admin__cell-updated {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.fs-admin__doc-link {
		color: var(--fs-admin-text);
		font-weight: 600;
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.fs-admin__doc-link:hover {
		color: var(--fs-admin-accent);
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.fs-admin__doc-link:focus-visible {
		outline: none;
		border-radius: var(--fs-radius-sm);
		box-shadow: var(--fs-focus-ring);
	}

	.fs-admin__cell-actions {
		text-align: right;
		white-space: nowrap;
	}

	/* Stacked "card" layout on narrow screens (single DOM, no duplicate links). */
	@media (max-width: 720px) {
		.fs-admin__table-wrap {
			overflow-x: visible;
		}

		.fs-admin__table thead {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
		}

		.fs-admin__table tbody tr {
			display: grid;
			gap: 0.25rem;
			padding: 0.875rem 1rem;
			border-top: 1px solid var(--fs-admin-border);
		}

		.fs-admin__table tbody tr:first-child {
			border-top: none;
		}

		.fs-admin__table tbody td {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			height: auto;
			padding: 0.125rem 0;
			border: none;
			white-space: normal;
		}

		.fs-admin__table tbody td::before {
			content: attr(data-label);
			color: var(--fs-admin-faint);
			font-size: 0.6875rem;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}

		.fs-admin__cell-title {
			font-size: 1rem;
		}

		.fs-admin__cell-title::before {
			display: none;
		}

		.fs-admin__cell-actions {
			justify-content: flex-start;
			margin-top: 0.25rem;
		}

		.fs-admin__cell-actions::before {
			display: none;
		}
	}
</style>
