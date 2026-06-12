<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { CollectionRuntimeConfig } from '@fieldstone/core';
	import { fromAction } from 'svelte/attachments';

	import CollectionNav from './CollectionNav.svelte';
	import CreateDocumentForm from './CreateDocumentForm.svelte';
	import DocumentList from './DocumentList.svelte';
	import { formDataToDocumentData, getCollectionLabel, getSelectedCollection } from './labels';
	import type { FieldstoneAdminRemotes } from './remote';
	import { getAdminSegments } from './route';

	let { remotes }: { remotes: FieldstoneAdminRemotes } = $props();

	let currentPathname = $state<string>(page.url.pathname);

	afterNavigate(({ to }) => {
		currentPathname = to?.url.pathname ?? page.url.pathname;
	});

	const routeSegments = $derived(getAdminSegments(currentPathname));
	const routeKey = $derived(routeSegments.join('/'));

	function collectionHref(slug: string) {
		return resolve(`/admin/collections/${slug}`);
	}

	function redirectToDefaultCollection(node: HTMLAnchorElement, slug: string) {
		goto(collectionHref(slug), { replaceState: true });
	}

	let editingId = $state<string | null>(null);
	let errorMessage = $state('');

	const viewQuery = $derived(remotes.getAdminView({ segments: routeSegments }));
	const selectedCollectionSlug = $derived(
		routeSegments.length === 2 && routeSegments[0] === 'collections'
			? (routeSegments[1] ?? null)
			: null
	);
	const documentsQuery = $derived(
		selectedCollectionSlug ? remotes.listDocuments({ collection: selectedCollectionSlug }) : null
	);

	async function refreshDocuments() {
		await documentsQuery?.refresh();
	}

	async function handleCreate(event: SubmitEvent, collection: CollectionRuntimeConfig) {
		event.preventDefault();
		errorMessage = '';

		const form = event.currentTarget as HTMLFormElement;

		try {
			await remotes.createDocument({
				collection: collection.slug,
				data: formDataToDocumentData(form, collection)
			});
			form.reset();
			await refreshDocuments();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not create document';
		}
	}

	async function startEdit(collection: string, id: string) {
		const document = await remotes.getDocument({ collection, id });
		if (!document) return;
		editingId = document.id;
	}

	async function handleUpdate(event: SubmitEvent, collection: string) {
		event.preventDefault();
		if (!editingId) return;
		errorMessage = '';

		const form = event.currentTarget as HTMLFormElement;
		const view = await viewQuery;
		if (view.type !== 'collection') return;

		try {
			await remotes.updateDocument({
				collection,
				id: editingId,
				data: formDataToDocumentData(form, view.collection)
			});
			editingId = null;
			await refreshDocuments();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not update document';
		}
	}

	async function handleDelete(collection: string, id: string) {
		errorMessage = '';

		try {
			await remotes.deleteDocument({ collection, id });
			if (editingId === id) editingId = null;
			await refreshDocuments();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not delete document';
		}
	}
</script>

{#key routeKey}
	{#await viewQuery then view}
		{#if view.type === 'index'}
			<main class="fs-admin">
				{#if view.defaultCollection}
					<a
						class="fs-admin__link"
						href={collectionHref(view.defaultCollection.slug)}
						{@attach fromAction(redirectToDefaultCollection, () => view.defaultCollection.slug)}
					>
						Open {view.defaultCollection.slug}
					</a>
				{:else}
					<p class="fs-admin__muted">No collections found.</p>
				{/if}
			</main>
		{:else}
			{@const collectionName = selectedCollectionSlug ?? view.collectionName}
			{@const collection = getSelectedCollection(view.collections, collectionName, view.collection)}
			{@const documents = documentsQuery}

			<main class="fs-admin">
				<div class="fs-admin__grid">
					<section class="fs-admin__sidebar">
						<div>
							<p class="fs-admin__eyebrow">CMS</p>
							<h1 class="fs-admin__title">
								{getCollectionLabel(collection, 'plural')}
							</h1>
						</div>

						<CollectionNav
							collections={view.collections}
							{collectionHref}
							{selectedCollectionSlug}
						/>

						<CreateDocumentForm {collection} oncreate={handleCreate} />

						{#if errorMessage}
							<p class="fs-admin__error">{errorMessage}</p>
						{/if}
					</section>

					<section class="fs-admin__documents">
						{#if documents}
							{#await documents then documentList}
								{#if documentList.error}
									<p class="fs-admin__error">{documentList.error}</p>
								{/if}

								<DocumentList
									{collection}
									{collectionName}
									documents={documentList.documents}
									{editingId}
									oncancel={() => (editingId = null)}
									ondelete={handleDelete}
									onedit={startEdit}
									onupdate={handleUpdate}
								/>
							{/await}
						{/if}
					</section>
				</div>
			</main>
		{/if}
	{/await}
{/key}

<style>
	.fs-admin__grid {
		display: grid;
		gap: 2rem;
		max-width: 72rem;
		margin: 0 auto;
	}

	.fs-admin__sidebar,
	.fs-admin__documents {
		display: grid;
		gap: 1rem;
	}

	.fs-admin__documents {
		gap: 0.75rem;
	}

	.fs-admin__eyebrow {
		margin: 0;
		color: var(--fs-admin-muted);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.fs-admin__title {
		margin: 0;
		font-size: 1.875rem;
		line-height: 2.25rem;
		font-weight: 600;
	}

	.fs-admin__error {
		border: 1px solid var(--fs-admin-danger-border);
		border-radius: 0.5rem;
		background: var(--fs-admin-danger-bg);
		color: var(--fs-admin-danger);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}

	.fs-admin__muted {
		color: var(--fs-admin-muted);
	}

	.fs-admin__link {
		border-radius: 0.375rem;
		color: var(--fs-admin-muted);
		font-size: 0.875rem;
		font-weight: 500;
		text-underline-offset: 0.25rem;
	}

	@media (min-width: 1024px) {
		.fs-admin__grid {
			grid-template-columns: 20rem 1fr;
		}
	}
</style>
