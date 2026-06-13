<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';

	import CollectionNav from './CollectionNav.svelte';
	import CreateDocumentForm from './CreateDocumentForm.svelte';
	import DocumentEditForm from './DocumentEditForm.svelte';
	import DocumentList from './DocumentList.svelte';
	import { getCollectionLabel, getFieldLabel, getFieldValue } from './labels';
	import Button from './primitives/Button.svelte';
	import type { FieldstoneAdminRemotes } from '@fieldstone/remotes';
	import {
		adminCollectionPath,
		adminDocumentPath,
		adminEditDocumentPath,
		adminIndexPath,
		adminNewDocumentPath,
		getAdminSegments,
		parseAdminRoute,
		type AdminRoute
	} from '@fieldstone/routes';

	let { remotes }: { remotes: FieldstoneAdminRemotes } = $props();

	let currentPathname = $state<string>(page.url.pathname);

	afterNavigate(({ to }) => {
		currentPathname = to?.url.pathname ?? page.url.pathname;
	});

	const route = $derived(parseAdminRoute(getAdminSegments(currentPathname)));
	const routeKey = $derived(currentPathname);

	$effect(() => {
		if (route.type !== 'documentEdit') return;
		void remotes.getDocument({ collection: route.collection, id: route.id }).refresh();
	});

	function routeCollection(route: AdminRoute) {
		return 'collection' in route ? route.collection : null;
	}

	function getBoundaryErrorMessage(error: unknown) {
		return error instanceof Error ? error.message : 'Could not load admin data';
	}

	function collectionHref(collection: string) {
		return adminCollectionPath(collection, base);
	}

	function newDocumentHref(collection: string) {
		return adminNewDocumentPath(collection, base);
	}

	function documentHref(collection: string, id: string) {
		return adminDocumentPath(collection, id, base);
	}

	function editDocumentHref(collection: string, id: string) {
		return adminEditDocumentPath(collection, id, base);
	}
</script>

{#key routeKey}
	<main class="fs-admin">
		<svelte:boundary>
			{@const collections = await remotes.listCollections()}
			{@const selectedCollectionSlug = routeCollection(route)}
			{@const selectedCollection =
				collections.find((collection) => collection.slug === selectedCollectionSlug) ?? null}

			{#if route.type === 'index'}
				<section class="fs-admin__index">
					<div>
						<p class="fs-admin__eyebrow">CMS</p>
						<h1 class="fs-admin__title">Collections</h1>
					</div>

					{#if collections.length}
						<CollectionNav
							{collections}
							{collectionHref}
							selectedCollectionSlug={null}
						/>
					{:else}
						<p class="fs-admin__muted">No collections found.</p>
					{/if}
				</section>
			{:else if route.type === 'notFound'}
				<section class="fs-admin__index">
					<h1 class="fs-admin__title">Admin route not found</h1>
					<Button href={adminIndexPath(base)}>Back to admin</Button>
				</section>
			{:else}
				<div class="fs-admin__grid">
					<section class="fs-admin__sidebar">
						<div>
							<p class="fs-admin__eyebrow">CMS</p>
							<h1 class="fs-admin__title">
								{selectedCollection
									? getCollectionLabel(selectedCollection, 'plural')
									: selectedCollectionSlug}
							</h1>
						</div>

						<CollectionNav
							{collections}
							{collectionHref}
							{selectedCollectionSlug}
						/>

						{#if selectedCollectionSlug}
							<Button variant="primary" href={newDocumentHref(selectedCollectionSlug)}>
								New {selectedCollection ? getCollectionLabel(selectedCollection, 'singular').toLowerCase() : 'document'}
							</Button>
						{/if}
					</section>

					<section class="fs-admin__documents">
						{#if route.type === 'collectionList'}
							<svelte:boundary>
								{@const collection = await remotes.getCollection({ collection: route.collection })}

								<div class="fs-admin__section-header">
									<h2 class="fs-admin__section-title">
										{getCollectionLabel(collection, 'plural')}
									</h2>
									<Button href={newDocumentHref(collection.slug)}>New</Button>
								</div>

								<svelte:boundary>
									<DocumentList
										{collection}
										documents={await remotes.listDocuments({ collection: collection.slug })}
									/>

									{#snippet pending()}
										<p class="fs-admin__muted">Loading documents...</p>
									{/snippet}

									{#snippet failed(error, reset)}
										<div class="fs-admin__error">
											<p>{getBoundaryErrorMessage(error)}</p>
											<Button type="button" onclick={reset}>Retry</Button>
										</div>
									{/snippet}
								</svelte:boundary>

								{#snippet pending()}
									<p class="fs-admin__muted">Loading collection...</p>
								{/snippet}

								{#snippet failed(error, reset)}
									<div class="fs-admin__error">
										<p>{getBoundaryErrorMessage(error)}</p>
										<Button type="button" onclick={reset}>Retry</Button>
									</div>
								{/snippet}
							</svelte:boundary>
						{:else if route.type === 'collectionNew'}
							<svelte:boundary>
								{@const collection = await remotes.getCollection({ collection: route.collection })}

								<div class="fs-admin__section-header">
									<h2 class="fs-admin__section-title">
										New {getCollectionLabel(collection, 'singular').toLowerCase()}
									</h2>
									<Button href={collectionHref(collection.slug)}>Back to list</Button>
								</div>

								<CreateDocumentForm collection={collection} form={remotes.createDocument.for(collection.slug)} />

								{#snippet pending()}
									<p class="fs-admin__muted">Loading collection...</p>
								{/snippet}

								{#snippet failed(error, reset)}
									<div class="fs-admin__error">
										<p>{getBoundaryErrorMessage(error)}</p>
										<Button type="button" onclick={reset}>Retry</Button>
									</div>
								{/snippet}
							</svelte:boundary>
						{:else if route.type === 'documentDetail'}
							<svelte:boundary>
								{@const collection = await remotes.getCollection({ collection: route.collection })}

								<svelte:boundary>
									{@const document = await remotes.getDocument({
										collection: collection.slug,
										id: route.id
									})}
									{@const deleteForm = remotes.deleteDocument.for(document.id)}

									<article class="fs-admin__panel fs-admin__detail">
										<div class="fs-admin__section-header">
											<h2 class="fs-admin__section-title">
												{getFieldValue(document, collection.fields[0]?.name ?? 'id')}
											</h2>
											<div class="fs-admin__actions">
												<Button href={editDocumentHref(collection.slug, document.id)}>Edit</Button>
												<Button href={collectionHref(collection.slug)}>Back to list</Button>
											</div>
										</div>

										<dl class="fs-admin__fields">
											{#each collection.fields as field (field.name)}
												<div class="fs-admin__field-row">
													<dt>{getFieldLabel(field)}</dt>
													<dd>{getFieldValue(document, field.name) || 'Empty'}</dd>
												</div>
											{/each}
										</dl>

										<form class="fs-admin__delete-form" {...deleteForm}>
											<input {...deleteForm.fields.collection.as('hidden', collection.slug)} />
											<input {...deleteForm.fields.id.as('hidden', document.id)} />

											{#each deleteForm.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
												<p class="fs-admin__error">{issue.message}</p>
											{/each}

											<Button variant="danger" disabled={Boolean(deleteForm.pending)}>
												Delete {getCollectionLabel(collection, 'singular').toLowerCase()}
											</Button>
										</form>
									</article>

									{#snippet pending()}
										<p class="fs-admin__muted">Loading document...</p>
									{/snippet}

									{#snippet failed(error, reset)}
										<div class="fs-admin__error">
											<p>{getBoundaryErrorMessage(error)}</p>
											<Button type="button" onclick={reset}>Retry</Button>
										</div>
									{/snippet}
								</svelte:boundary>

								{#snippet pending()}
									<p class="fs-admin__muted">Loading collection...</p>
								{/snippet}

								{#snippet failed(error, reset)}
									<div class="fs-admin__error">
										<p>{getBoundaryErrorMessage(error)}</p>
										<Button type="button" onclick={reset}>Retry</Button>
									</div>
								{/snippet}
							</svelte:boundary>
						{:else if route.type === 'documentEdit'}
							<svelte:boundary>
								{@const collection = await remotes.getCollection({ collection: route.collection })}

								<svelte:boundary>
									{@const document = await remotes.getDocument({
										collection: collection.slug,
										id: route.id
									})}
									{@const updateForm = remotes.updateDocument.for(document.id)}

									<div class="fs-admin__section-header">
										<h2 class="fs-admin__section-title">
											Edit {getCollectionLabel(collection, 'singular').toLowerCase()}
										</h2>
										<Button href={documentHref(collection.slug, document.id)}>Back to detail</Button>
									</div>

									<DocumentEditForm {collection} {document} form={updateForm} />

									{#snippet pending()}
										<p class="fs-admin__muted">Loading document...</p>
									{/snippet}

									{#snippet failed(error, reset)}
										<div class="fs-admin__error">
											<p>{getBoundaryErrorMessage(error)}</p>
											<Button type="button" onclick={reset}>Retry</Button>
										</div>
									{/snippet}
								</svelte:boundary>

								{#snippet pending()}
									<p class="fs-admin__muted">Loading collection...</p>
								{/snippet}

								{#snippet failed(error, reset)}
									<div class="fs-admin__error">
										<p>{getBoundaryErrorMessage(error)}</p>
										<Button type="button" onclick={reset}>Retry</Button>
									</div>
								{/snippet}
							</svelte:boundary>
						{/if}
					</section>
				</div>
			{/if}

			{#snippet pending()}
				<p class="fs-admin__muted">Loading collections...</p>
			{/snippet}

			{#snippet failed(error, reset)}
				<div class="fs-admin__error">
					<p>{getBoundaryErrorMessage(error)}</p>
					<Button type="button" onclick={reset}>Retry</Button>
				</div>
			{/snippet}
		</svelte:boundary>
	</main>
{/key}

<style>
	.fs-admin__grid {
		display: grid;
		gap: 2rem;
		max-width: 72rem;
		margin: 0 auto;
	}

	.fs-admin__index,
	.fs-admin__sidebar,
	.fs-admin__documents {
		display: grid;
		gap: 1rem;
	}

	.fs-admin__sidebar {
		align-content: start;
		align-items: start;
	}

	.fs-admin__index {
		max-width: 48rem;
		margin: 0 auto;
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

	.fs-admin__section-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.fs-admin__section-title {
		margin: 0;
		overflow-wrap: anywhere;
		font-size: 1.25rem;
		line-height: 1.75rem;
		font-weight: 600;
	}

	.fs-admin__panel {
		border: 1px solid var(--fs-admin-border);
		border-radius: 0.5rem;
		background: var(--fs-admin-panel);
		padding: 1rem;
	}

	.fs-admin__detail {
		display: grid;
		gap: 1.25rem;
	}

	.fs-admin__fields {
		display: grid;
		gap: 0.75rem;
		margin: 0;
	}

	.fs-admin__field-row {
		display: grid;
		gap: 0.25rem;
	}

	.fs-admin__field-row dt {
		color: var(--fs-admin-muted);
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.fs-admin__field-row dd {
		margin: 0;
		overflow-wrap: anywhere;
		font-size: 0.9375rem;
		line-height: 1.5rem;
	}

	.fs-admin__actions,
	.fs-admin__delete-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.fs-admin__error {
		border: 1px solid var(--fs-admin-danger-border);
		border-radius: 0.5rem;
		background: var(--fs-admin-danger-bg);
		color: var(--fs-admin-danger);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}

	.fs-admin__error p {
		margin: 0 0 0.5rem;
	}

	.fs-admin__error p:last-child {
		margin-bottom: 0;
	}

	.fs-admin__muted {
		color: var(--fs-admin-muted);
	}

	@media (min-width: 1024px) {
		.fs-admin__grid {
			grid-template-columns: 20rem 1fr;
		}
	}
</style>
