<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { CollectionRuntimeConfig } from '@fieldstone/core';
	import { fromAction } from 'svelte/attachments';

	import type { AdminRemotes } from './remote';
	import { getAdminSegments } from './route';

	let { remotes }: { remotes: AdminRemotes } = $props();

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

	function titleCase(value: string) {
		return value
			.split(/[-_\s]+/)
			.filter(Boolean)
			.map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
			.join(' ');
	}

	function singularize(slug: string) {
		return slug.endsWith('s') ? slug.slice(0, -1) : slug;
	}

	function getCollectionLabel(collection: CollectionRuntimeConfig, count: 'singular' | 'plural') {
		return titleCase(count === 'singular' ? singularize(collection.slug) : collection.slug);
	}

	function getSelectedCollection(
		collections: CollectionRuntimeConfig[],
		collectionName: string,
		fallback: CollectionRuntimeConfig
	) {
		return collections.find((collection) => collection.slug === collectionName) ?? fallback;
	}

	function getFieldLabel(field: CollectionRuntimeConfig['fields'][number]) {
		return titleCase(field.name);
	}

	function formDataToDocumentData(form: HTMLFormElement, collection: CollectionRuntimeConfig) {
		const formData = new FormData(form);
		return Object.fromEntries(
			collection.fields.map((field) => [field.name, String(formData.get(field.name) ?? '')])
		);
	}

	function getFieldValue(document: Record<string, unknown>, fieldName: string) {
		return String(document[fieldName] ?? '');
	}

	function shouldUseTextarea(field: CollectionRuntimeConfig['fields'][number]) {
		return Boolean(field.multiline);
	}

	let editingId = $state<string | null>(null);
	let editData = $state<Record<string, string>>({});
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

		const view = await viewQuery;
		if (view.type !== 'collection') return;

		editingId = document.id;
		editData = Object.fromEntries(
			view.collection.fields.map((field) => [field.name, getFieldValue(document, field.name)])
		);
	}

	async function handleUpdate(event: SubmitEvent, collection: string) {
		event.preventDefault();
		if (!editingId) return;
		errorMessage = '';

		try {
			await remotes.updateDocument({
				collection,
				id: editingId,
				data: editData
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

						<nav class="fs-admin__nav" aria-label="Collections">
							{#each view.collections as navCollection (navCollection.slug)}
								<a
									class={[
										'fs-admin__nav-link',
										navCollection.slug === selectedCollectionSlug && 'fs-admin__nav-link--active'
									]}
									aria-current={navCollection.slug === selectedCollectionSlug ? 'page' : undefined}
									href={collectionHref(navCollection.slug)}
								>
									{getCollectionLabel(navCollection, 'plural')}
								</a>
							{/each}
						</nav>

						<form
							class="fs-admin__panel fs-admin__form"
							onsubmit={(event) => handleCreate(event, collection)}
						>
							{#each collection.fields as field (field.name)}
								<div class="fs-admin__field">
									<label class="fs-admin__label" for={field.name}>{getFieldLabel(field)}</label>
									{#if shouldUseTextarea(field)}
										<textarea
											class="fs-admin__textarea"
											id={field.name}
											name={field.name}
											required={field.required}
										></textarea>
									{:else}
										<input
											class="fs-admin__input"
											id={field.name}
											name={field.name}
											required={field.required}
										/>
									{/if}
								</div>
							{/each}

							<button class="fs-admin__button fs-admin__button--primary">
								Create {getCollectionLabel(collection, 'singular').toLowerCase()}
							</button>
						</form>

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

								{#each documentList.documents as document (document.id)}
									<article class="fs-admin__panel">
										{#if editingId === document.id}
											<form
												class="fs-admin__form"
												onsubmit={(event) => handleUpdate(event, collectionName)}
											>
												{#each collection.fields as field (field.name)}
													<div class="fs-admin__field">
														<label class="fs-admin__label" for={`${field.name}-${document.id}`}>
															{getFieldLabel(field)}
														</label>
														{#if shouldUseTextarea(field)}
															<textarea
																class="fs-admin__textarea fs-admin__textarea--compact"
																id={`${field.name}-${document.id}`}
																bind:value={editData[field.name]}
																required={field.required}
															></textarea>
														{:else}
															<input
																class="fs-admin__input"
																id={`${field.name}-${document.id}`}
																bind:value={editData[field.name]}
																required={field.required}
															/>
														{/if}
													</div>
												{/each}
												<div class="fs-admin__actions">
													<button class="fs-admin__button fs-admin__button--primary">Save</button>
													<button
														class="fs-admin__button"
														type="button"
														onclick={() => (editingId = null)}
													>
														Cancel
													</button>
												</div>
											</form>
										{:else}
											<div class="fs-admin__document">
												<div class="fs-admin__document-body">
													<h2 class="fs-admin__document-title">
														{getFieldValue(document, collection.fields[0]?.name ?? 'id')}
													</h2>
													{#each collection.fields.slice(1) as field (field.name)}
														<p class="fs-admin__document-text">
															{getFieldValue(document, field.name)}
														</p>
													{/each}
												</div>
												<div class="fs-admin__actions">
													<button
														class="fs-admin__button"
														type="button"
														onclick={() => startEdit(collectionName, document.id)}
													>
														Edit
													</button>
													<button
														class="fs-admin__button fs-admin__button--danger"
														type="button"
														onclick={() => handleDelete(collectionName, document.id)}
													>
														Delete
													</button>
												</div>
											</div>
										{/if}
									</article>
								{:else}
									<div class="fs-admin__empty">
										No {getCollectionLabel(collection, 'plural').toLowerCase()} yet.
									</div>
								{/each}
							{/await}
						{/if}
					</section>
				</div>
			</main>
		{/if}
	{/await}
{/key}
