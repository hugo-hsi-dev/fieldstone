<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	import CollectionNav from './CollectionNav.svelte';
	import CreateDocumentForm from './CreateDocumentForm.svelte';
	import DocumentEditForm from './DocumentEditForm.svelte';
	import DocumentList from './DocumentList.svelte';
	import GlobalEditForm from './GlobalEditForm.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import Icon from './primitives/Icon.svelte';
	import {
		collectionLabelFromSlug,
		getCollectionLabel,
		getFieldLabel,
		getFieldValue,
		stripHtml,
		getGlobalLabel,
		globalLabelFromSlug
	} from './labels';
	import Button from './primitives/Button.svelte';
	import type { CollectionRuntimeConfig, FieldDefinition } from '@fieldstone/schema';
	import type { FieldstoneAdminRemotes } from '@fieldstone/remotes';
	import {
		adminCollectionPath,
		adminDocumentPath,
		adminEditDocumentPath,
		adminGlobalPath,
		adminIndexPath,
		adminNewDocumentPath,
		adminRouteId,
		adminRouteSegments,
		getAdminSegments,
		parseAdminRoute,
		type AdminRoute
	} from '@fieldstone/routes';

	let { remotes }: { remotes: FieldstoneAdminRemotes } = $props();

	// Transient success toast (auto-dismissed). Owned here so it survives the
	// post-save/delete redirect that the mutation forms trigger.
	let toast = $state<{ id: number; tone: 'success' | 'error'; text: string } | null>(null);
	let toastSeq = 0;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	function showToast(text: string, tone: 'success' | 'error' = 'success') {
		toast = { id: (toastSeq += 1), tone, text };
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toast = null;
		}, 4000);
	}

	onDestroy(() => clearTimeout(toastTimer));

	// Confirmation dialog for destructive document deletes.
	let deleteDialog = $state<HTMLDialogElement>();

	const currentPathname = $derived(page.url.pathname);
	const route = $derived(parseAdminRoute(getAdminSegments(currentPathname)));
	const routeKey = $derived(currentPathname);

	$effect(() => {
		// Refresh the cached document when viewing or editing it, so the detail page
		// reflects a just-saved edit (the update redirects back here) instead of a
		// stale cached copy.
		if (route.type !== 'documentEdit' && route.type !== 'documentDetail') return;
		void remotes.getDocument({ collection: route.collection, id: route.id }).refresh();
	});

	const PAGE_SIZE = 10;
	let searchInput = $state('');
	let appliedSearch = $state('');
	let pageIndex = $state(0);
	const listCollectionSlug = $derived(route.type === 'collectionList' ? route.collection : null);

	$effect(() => {
		// Reset search and paging when switching collections.
		void listCollectionSlug;
		searchInput = '';
		appliedSearch = '';
		pageIndex = 0;
	});

	// Mobile navigation drawer.
	let drawerOpen = $state(false);
	// Whether the layout is in drawer mode (must match the 960px CSS breakpoint),
	// so off-canvas nav is only made inert / focus-managed on narrow viewports.
	let isNarrow = $state(false);
	let hamburgerEl = $state<HTMLButtonElement>();
	let sidebarEl = $state<HTMLElement>();

	$effect(() => {
		// Close the drawer whenever the route changes.
		void routeKey;
		drawerOpen = false;
	});

	onMount(() => {
		const query = window.matchMedia('(max-width: 960px)');
		isNarrow = query.matches;
		const onChange = (event: MediaQueryListEvent) => {
			isNarrow = event.matches;
		};
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	// Move focus into the drawer when it opens and back to the trigger when it
	// closes (drawer mode only), per the WAI-ARIA disclosure pattern.
	let drawerWasOpen = false;
	$effect(() => {
		const open = drawerOpen;
		if (!isNarrow) {
			drawerWasOpen = open;
			return;
		}
		if (open && !drawerWasOpen) {
			const first = sidebarEl?.querySelector<HTMLElement>('a, button');
			(first ?? sidebarEl)?.focus();
		} else if (!open && drawerWasOpen) {
			hamburgerEl?.focus();
		}
		drawerWasOpen = open;
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') drawerOpen = false;
	}

	function applySearch(event: SubmitEvent) {
		event.preventDefault();
		appliedSearch = searchInput.trim();
		pageIndex = 0;
	}

	async function loadRelationOptions(collection: CollectionRuntimeConfig) {
		// Collect every relationship target, including those nested inside group/array
		// fields, and key the options by the target slug so top-level and nested
		// relationship inputs can both look them up.
		const targets: string[] = [];
		const collect = (fields: readonly FieldDefinition[]) => {
			for (const field of fields) {
				if (field.type === 'relationship') {
					if (!targets.includes(field.relationTo)) targets.push(field.relationTo);
				} else if (field.type === 'group' || field.type === 'array') {
					collect(field.fields);
				}
			}
		};
		collect(collection.fields);
		const entries = await Promise.all(
			targets.map(
				async (slug) => [slug, await remotes.listRelationOptions({ collection: slug })] as const
			)
		);
		return Object.fromEntries(entries);
	}

	function routeCollection(route: AdminRoute) {
		return 'collection' in route ? route.collection : null;
	}

	function routeGlobal(route: AdminRoute) {
		return 'global' in route ? route.global : null;
	}

	const selectedCollectionSlug = $derived(routeCollection(route));
	const selectedGlobalSlug = $derived(routeGlobal(route));

	function getBoundaryErrorMessage(error: unknown) {
		if (error instanceof Error) return error.message;
		if (error && typeof error === 'object' && 'message' in error)
			return String((error as { message: unknown }).message);
		return 'Could not load admin data';
	}

	function resolveAdminPath(path: string) {
		return resolve(adminRouteId, { segments: adminRouteSegments(path) });
	}

	const indexHref = $derived(resolveAdminPath(adminIndexPath()));

	function collectionHref(collection: string) {
		return resolveAdminPath(adminCollectionPath(collection));
	}

	function newDocumentHref(collection: string) {
		return resolveAdminPath(adminNewDocumentPath(collection));
	}

	function globalHref(global: string) {
		return resolveAdminPath(adminGlobalPath(global));
	}

	function documentHref(collection: string, id: string) {
		return resolveAdminPath(adminDocumentPath(collection, id));
	}

	function editDocumentHref(collection: string, id: string) {
		return resolveAdminPath(adminEditDocumentPath(collection, id));
	}

	// Breadcrumb trail derived from the route alone (slug-based labels), so the
	// header renders immediately without waiting on data.
	type Crumb = { label: string; href?: string };
	const crumbs = $derived.by<Crumb[]>(() => {
		switch (route.type) {
			case 'collectionList':
				return [{ label: collectionLabelFromSlug(route.collection, 'plural') }];
			case 'collectionNew':
				return [
					{
						label: collectionLabelFromSlug(route.collection, 'plural'),
						href: collectionHref(route.collection)
					},
					{ label: 'New' }
				];
			case 'documentDetail':
				return [
					{
						label: collectionLabelFromSlug(route.collection, 'plural'),
						href: collectionHref(route.collection)
					},
					{ label: collectionLabelFromSlug(route.collection, 'singular') }
				];
			case 'documentEdit':
				return [
					{
						label: collectionLabelFromSlug(route.collection, 'plural'),
						href: collectionHref(route.collection)
					},
					{
						label: collectionLabelFromSlug(route.collection, 'singular'),
						href: documentHref(route.collection, route.id)
					},
					{ label: 'Edit' }
				];
			case 'globalEdit':
				return [{ label: globalLabelFromSlug(route.global) }];
			case 'notFound':
				return [{ label: 'Not found' }];
			default:
				return [];
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet navSkeleton()}
	<div class="fs-admin__nav-skeleton" aria-hidden="true">
		<div
			class="fs-admin__skeleton"
			style="height:0.75rem;width:5rem;margin:0 0 0.5rem 0.5rem"
		></div>
		{#each Array.from({ length: 5 }, (_, i) => i) as index (index)}
			<div class="fs-admin__skeleton" style="height:2rem;border-radius:var(--fs-radius-sm)"></div>
		{/each}
	</div>
{/snippet}

{#snippet dashboardSkeleton()}
	<div class="fs-admin__dashboard" aria-hidden="true">
		{#each Array.from({ length: 4 }, (_, i) => i) as index (index)}
			<div class="fs-admin__skeleton" style="height:6rem;border-radius:var(--fs-radius-md)"></div>
		{/each}
	</div>
{/snippet}

{#snippet listSkeleton()}
	<div aria-hidden="true">
		<div class="fs-admin__skeleton" style="height:2.25rem;max-width:24rem;margin-bottom:1rem"></div>
		<div class="fs-admin__skeleton" style="height:18rem;border-radius:var(--fs-radius-md)"></div>
	</div>
{/snippet}

{#snippet tableSkeleton()}
	<div
		class="fs-admin__skeleton"
		style="height:18rem;border-radius:var(--fs-radius-md)"
		aria-hidden="true"
	></div>
{/snippet}

{#snippet formSkeleton()}
	<div class="fs-admin__panel fs-admin__form" aria-hidden="true">
		{#each Array.from({ length: 5 }, (_, i) => i) as index (index)}
			<div style="display:grid;gap:0.5rem">
				<div class="fs-admin__skeleton" style="height:0.875rem;width:6rem"></div>
				<div class="fs-admin__skeleton" style="height:2.25rem"></div>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet detailSkeleton()}
	<div aria-hidden="true">
		<div class="fs-admin__skeleton" style="height:1.875rem;width:14rem;margin-bottom:0.75rem"></div>
		<div class="fs-admin__skeleton" style="height:1rem;width:11rem;margin-bottom:1.5rem"></div>
		<div class="fs-admin__skeleton" style="height:16rem;border-radius:var(--fs-radius-md)"></div>
	</div>
{/snippet}

{#snippet errorBox(error: unknown, reset: () => void)}
	<div class="fs-admin__error" role="alert">
		<p class="fs-admin__error-title">
			<Icon name="alert" />
			<span>Something went wrong</span>
		</p>
		<p>{getBoundaryErrorMessage(error)}</p>
		<div>
			<Button type="button" size="sm" onclick={reset}>Try again</Button>
		</div>
	</div>
{/snippet}

<div class="fs-admin" data-sveltekit-preload-data="off" class:fs-admin--drawer-open={drawerOpen}>
	<div class="fs-admin__shell">
		<header class="fs-admin__header">
			<button
				bind:this={hamburgerEl}
				type="button"
				class="fs-admin__hamburger fs-admin__button fs-admin__button--ghost fs-admin__button--icon"
				aria-label="Open navigation"
				aria-expanded={drawerOpen}
				aria-controls="fs-admin-nav"
				onclick={() => (drawerOpen = !drawerOpen)}
			>
				<Icon name="menu" size={18} />
			</button>

			<a class="fs-admin__brand" href={indexHref}>
				<span class="fs-admin__brandmark" aria-hidden="true">F</span>
				<span class="fs-admin__brand-name">Fieldstone</span>
			</a>

			{#if crumbs.length}
				<nav class="fs-admin__breadcrumb" aria-label="Breadcrumb">
					{#each crumbs as crumb, index (index)}
						<span class="fs-admin__crumb-sep" aria-hidden="true">/</span>
						{#if crumb.href}
							<a class="fs-admin__crumb" href={crumb.href}>{crumb.label}</a>
						{:else}
							<span class="fs-admin__crumb fs-admin__crumb--current" aria-current="page"
								>{crumb.label}</span
							>
						{/if}
					{/each}
				</nav>
			{/if}

			<div class="fs-admin__header-spacer"></div>
			<ThemeToggle />
		</header>

		<aside
			bind:this={sidebarEl}
			class="fs-admin__sidebar"
			id="fs-admin-nav"
			tabindex="-1"
			inert={isNarrow && !drawerOpen}
		>
			<svelte:boundary>
				{@const collections = await remotes.listCollections()}
				{@const globals = await remotes.listGlobals()}
				<CollectionNav
					{collections}
					{collectionHref}
					{globals}
					{globalHref}
					{selectedCollectionSlug}
					{selectedGlobalSlug}
				/>

				{#snippet pending()}
					{@render navSkeleton()}
				{/snippet}

				{#snippet failed(error, reset)}
					{@render errorBox(error, reset)}
				{/snippet}
			</svelte:boundary>
		</aside>

		<button
			type="button"
			class="fs-admin__scrim"
			tabindex="-1"
			aria-label="Close navigation"
			onclick={() => (drawerOpen = false)}
		></button>

		<main class="fs-admin__content" inert={isNarrow && drawerOpen}>
			{#key routeKey}
				{#if route.type === 'index'}
					<div class="fs-admin__page-header">
						<div class="fs-admin__page-heading">
							<h1 class="fs-admin__title">CMS</h1>
							<p class="fs-admin__subtitle">Manage your content collections and globals.</p>
						</div>
					</div>

					<svelte:boundary>
						{@const collections = await remotes.listCollections()}
						{@const globals = await remotes.listGlobals()}

						{#if collections.length || globals.length}
							<div class="fs-admin__dashboard">
								{#each collections as collection (collection.slug)}
									<a class="fs-admin__card" href={collectionHref(collection.slug)}>
										<span class="fs-admin__card-icon"><Icon name="collection" size={18} /></span>
										<span class="fs-admin__card-body">
											<span class="fs-admin__card-title"
												>{getCollectionLabel(collection, 'plural')}</span
											>
											<span class="fs-admin__card-meta">
												{collection.fields.length}
												{collection.fields.length === 1 ? 'field' : 'fields'}
											</span>
										</span>
										<span class="fs-admin__card-arrow" aria-hidden="true"
											><Icon name="chevron-right" /></span
										>
									</a>
								{/each}
								{#each globals as global (global.slug)}
									<a class="fs-admin__card" href={globalHref(global.slug)}>
										<span class="fs-admin__card-icon"><Icon name="globe" size={18} /></span>
										<span class="fs-admin__card-body">
											<span class="fs-admin__card-title">{getGlobalLabel(global)}</span>
											<span class="fs-admin__card-meta">Single document</span>
										</span>
										<span class="fs-admin__card-arrow" aria-hidden="true"
											><Icon name="chevron-right" /></span
										>
									</a>
								{/each}
							</div>
						{:else}
							<div class="fs-admin__empty">
								<span class="fs-admin__empty-icon"><Icon name="inbox" size={20} /></span>
								<p class="fs-admin__empty-title">No content yet</p>
								<p class="fs-admin__empty-text">No CMS collections or globals were found.</p>
							</div>
						{/if}

						{#snippet pending()}
							{@render dashboardSkeleton()}
						{/snippet}

						{#snippet failed(error, reset)}
							{@render errorBox(error, reset)}
						{/snippet}
					</svelte:boundary>
				{:else if route.type === 'collectionList'}
					<div class="fs-admin__page-header">
						<div class="fs-admin__page-heading">
							<h1 class="fs-admin__title">{collectionLabelFromSlug(route.collection, 'plural')}</h1>
						</div>
						<Button variant="primary" href={newDocumentHref(route.collection)}>
							<Icon name="plus" />
							New {collectionLabelFromSlug(route.collection, 'singular').toLowerCase()}
						</Button>
					</div>

					<svelte:boundary>
						{@const collection = await remotes.getCollection({ collection: route.collection })}

						<form class="fs-admin__search" onsubmit={applySearch}>
							<span class="fs-admin__search-icon" aria-hidden="true"><Icon name="search" /></span>
							<input
								class="fs-admin__input fs-admin__search-input"
								type="search"
								placeholder="Search {getCollectionLabel(collection, 'plural').toLowerCase()}..."
								aria-label="Search"
								bind:value={searchInput}
							/>
							<Button type="submit">Search</Button>
						</form>

						<svelte:boundary>
							{@const result = await remotes.listDocuments({
								collection: collection.slug,
								limit: PAGE_SIZE,
								offset: pageIndex * PAGE_SIZE,
								search: appliedSearch || undefined
							})}

							{#if result.total > 0}
								<p class="fs-admin__result-count">
									{result.total}
									{result.total === 1
										? getCollectionLabel(collection, 'singular').toLowerCase()
										: getCollectionLabel(collection, 'plural').toLowerCase()}
								</p>
							{/if}

							<DocumentList {collection} documents={result.docs} search={appliedSearch} />

							{#if result.total > PAGE_SIZE}
								<div class="fs-admin__pagination">
									<Button
										variant="ghost"
										type="button"
										disabled={pageIndex === 0}
										onclick={() => (pageIndex = Math.max(0, pageIndex - 1))}
									>
										Previous
									</Button>
									<span class="fs-admin__muted">
										Page {pageIndex + 1} of {Math.ceil(result.total / PAGE_SIZE)} ({result.total})
									</span>
									<Button
										variant="ghost"
										type="button"
										disabled={(pageIndex + 1) * PAGE_SIZE >= result.total}
										onclick={() => (pageIndex = pageIndex + 1)}
									>
										Next
									</Button>
								</div>
							{/if}

							{#snippet pending()}
								{@render tableSkeleton()}
							{/snippet}

							{#snippet failed(error, reset)}
								{@render errorBox(error, reset)}
							{/snippet}
						</svelte:boundary>

						{#snippet pending()}
							{@render listSkeleton()}
						{/snippet}

						{#snippet failed(error, reset)}
							{@render errorBox(error, reset)}
						{/snippet}
					</svelte:boundary>
				{:else if route.type === 'collectionNew'}
					<div class="fs-admin__page-header">
						<div class="fs-admin__page-heading">
							<h1 class="fs-admin__title">
								New {collectionLabelFromSlug(route.collection, 'singular').toLowerCase()}
							</h1>
						</div>
						<Button variant="ghost" href={collectionHref(route.collection)}>
							<Icon name="arrow-left" />
							Back to list
						</Button>
					</div>

					<svelte:boundary>
						{@const collection = await remotes.getCollection({ collection: route.collection })}
						{@const newRelationOptions = await loadRelationOptions(collection)}
						<CreateDocumentForm
							{collection}
							form={remotes.createDocument.for(collection.slug)}
							relationOptions={newRelationOptions}
							onSuccess={() => showToast(`${getCollectionLabel(collection, 'singular')} created`)}
						/>

						{#snippet pending()}
							{@render formSkeleton()}
						{/snippet}

						{#snippet failed(error, reset)}
							{@render errorBox(error, reset)}
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
							{@const deleteEnhanced = deleteForm.enhance(async (enhanced) => {
								const ok = await enhanced.submit();
								if (ok) showToast(`${getCollectionLabel(collection, 'singular')} deleted`);
							})}
							{@const titleField = collection.fields[0]?.name ?? 'id'}

							<div class="fs-admin__page-header">
								<div class="fs-admin__page-heading">
									<h1 class="fs-admin__title">
										{getFieldValue(document, titleField) ||
											collectionLabelFromSlug(route.collection, 'singular')}
									</h1>
									<p class="fs-admin__detail-meta">
										<span class="fs-admin__mono">{document.id}</span>
									</p>
								</div>
								<div class="fs-admin__actions">
									<Button variant="ghost" href={collectionHref(collection.slug)}>
										<Icon name="arrow-left" />
										Back to list
									</Button>
									<Button variant="primary" href={editDocumentHref(collection.slug, document.id)}>
										<Icon name="edit" />
										Edit
									</Button>
									<Button
										variant="danger-ghost"
										type="button"
										onclick={() => deleteDialog?.showModal()}
									>
										Delete {getCollectionLabel(collection, 'singular').toLowerCase()}
									</Button>
								</div>
							</div>

							<dialog
								bind:this={deleteDialog}
								class="fs-admin__dialog"
								aria-labelledby="fs-delete-title"
							>
								<h2 id="fs-delete-title" class="fs-admin__dialog-title">
									Delete {getCollectionLabel(collection, 'singular').toLowerCase()}?
								</h2>
								<p class="fs-admin__dialog-text">
									This permanently removes
									<strong>{getFieldValue(document, titleField) || document.id}</strong>. This can't
									be undone.
								</p>
								{#each deleteForm.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
									<p class="fs-admin__error">{issue.message}</p>
								{/each}
								<form class="fs-admin__delete-form fs-admin__dialog-actions" {...deleteEnhanced}>
									<input {...deleteForm.fields.collection.as('hidden', collection.slug)} />
									<input {...deleteForm.fields.id.as('hidden', document.id)} />
									<Button type="button" variant="ghost" onclick={() => deleteDialog?.close()}>
										Cancel
									</Button>
									<Button variant="danger" disabled={Boolean(deleteForm.pending)}>Delete</Button>
								</form>
							</dialog>

							{#if collection.fields.length}
								<dl class="fs-admin__panel fs-admin__fields">
									{#each collection.fields as field (field.name)}
										{@const raw = getFieldValue(document, field.name)}
										{@const display = field.type === 'richText' ? stripHtml(raw) : raw}
										<div class="fs-admin__field-row">
											<dt>{getFieldLabel(field)}</dt>
											<dd>
												{#if display}
													{display}
												{:else}
													<span class="fs-admin__field-empty">Empty</span>
												{/if}
											</dd>
										</div>
									{/each}
								</dl>
							{:else}
								<div class="fs-admin__panel fs-admin__empty">
									<p class="fs-admin__empty-text">This collection has no fields.</p>
								</div>
							{/if}

							{#snippet pending()}
								{@render detailSkeleton()}
							{/snippet}

							{#snippet failed(error, reset)}
								{@render errorBox(error, reset)}
							{/snippet}
						</svelte:boundary>

						{#snippet pending()}
							{@render detailSkeleton()}
						{/snippet}

						{#snippet failed(error, reset)}
							{@render errorBox(error, reset)}
						{/snippet}
					</svelte:boundary>
				{:else if route.type === 'documentEdit'}
					<div class="fs-admin__page-header">
						<div class="fs-admin__page-heading">
							<h1 class="fs-admin__title">
								Edit {collectionLabelFromSlug(route.collection, 'singular').toLowerCase()}
							</h1>
						</div>
						<Button variant="ghost" href={documentHref(route.collection, route.id)}>
							<Icon name="arrow-left" />
							Back to detail
						</Button>
					</div>

					<svelte:boundary>
						{@const collection = await remotes.getCollection({ collection: route.collection })}

						<svelte:boundary>
							{@const document = await remotes.getDocument({
								collection: collection.slug,
								id: route.id
							})}
							{@const updateForm = remotes.updateDocument.for(document.id)}
							{@const editRelationOptions = await loadRelationOptions(collection)}
							<DocumentEditForm
								{collection}
								{document}
								form={updateForm}
								relationOptions={editRelationOptions}
								onSuccess={() => showToast(`${getCollectionLabel(collection, 'singular')} saved`)}
							/>

							{#snippet pending()}
								{@render formSkeleton()}
							{/snippet}

							{#snippet failed(error, reset)}
								{@render errorBox(error, reset)}
							{/snippet}
						</svelte:boundary>

						{#snippet pending()}
							{@render formSkeleton()}
						{/snippet}

						{#snippet failed(error, reset)}
							{@render errorBox(error, reset)}
						{/snippet}
					</svelte:boundary>
				{:else if route.type === 'globalEdit'}
					<div class="fs-admin__page-header">
						<div class="fs-admin__page-heading">
							<h1 class="fs-admin__title">{globalLabelFromSlug(route.global)}</h1>
						</div>
					</div>

					<svelte:boundary>
						{@const global = await remotes.getGlobalConfig({ global: route.global })}
						{@const document = await remotes.getGlobal({ global: global.slug })}
						{@const updateForm = remotes.updateGlobal.for(global.slug)}
						{@const globalRelationOptions = await loadRelationOptions(global)}
						<GlobalEditForm
							globalConfig={global}
							{document}
							form={updateForm}
							relationOptions={globalRelationOptions}
							onSuccess={() => showToast(`${getGlobalLabel(global)} saved`)}
						/>

						{#snippet pending()}
							{@render formSkeleton()}
						{/snippet}

						{#snippet failed(error, reset)}
							{@render errorBox(error, reset)}
						{/snippet}
					</svelte:boundary>
				{:else}
					<div class="fs-admin__page-header">
						<div class="fs-admin__page-heading">
							<h1 class="fs-admin__title">Page not found</h1>
						</div>
					</div>
					<div class="fs-admin__empty">
						<span class="fs-admin__empty-icon"><Icon name="alert" size={20} /></span>
						<p class="fs-admin__empty-title">This admin route doesn't exist</p>
						<Button href={indexHref}>Back to admin</Button>
					</div>
				{/if}
			{/key}
		</main>
	</div>

	{#if toast}
		{#key toast.id}
			<div
				class={['fs-admin__toast', `fs-admin__toast--${toast.tone}`]}
				role="status"
				aria-live="polite"
			>
				<span class="fs-admin__toast-icon">
					<Icon name={toast.tone === 'success' ? 'check' : 'alert'} size={16} />
				</span>
				<span class="fs-admin__toast-text">{toast.text}</span>
				<button
					type="button"
					class="fs-admin__toast-close"
					aria-label="Dismiss notification"
					onclick={() => (toast = null)}
				>
					<Icon name="close" size={14} />
				</button>
			</div>
		{/key}
	{/if}
</div>

<style>
	/* ---- Shell grid ---- */
	.fs-admin__shell {
		display: grid;
		grid-template-columns: var(--fs-sidebar-w) 1fr;
		grid-template-rows: var(--fs-header-h) 1fr;
		min-height: 100dvh;
	}

	/* ---- Header ---- */
	.fs-admin__header {
		grid-column: 1 / -1;
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: var(--fs-space-3);
		height: var(--fs-header-h);
		padding: 0 var(--fs-space-6);
		border-bottom: 1px solid var(--fs-admin-border);
		background: color-mix(in srgb, var(--fs-admin-panel) 85%, transparent);
		backdrop-filter: blur(8px);
		--fs-focus-gap: var(--fs-admin-panel);
	}

	.fs-admin__brand {
		display: inline-flex;
		align-items: center;
		gap: var(--fs-space-2);
		color: var(--fs-admin-text-strong);
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		text-decoration: none;
		white-space: nowrap;
	}

	.fs-admin__brand:focus-visible {
		outline: none;
		border-radius: var(--fs-radius-sm);
		box-shadow: var(--fs-focus-ring);
	}

	.fs-admin__brandmark {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--fs-radius-sm);
		background: var(--fs-admin-primary);
		color: var(--fs-admin-primary-fg);
		font-size: 0.8125rem;
		font-weight: 700;
	}

	.fs-admin__breadcrumb {
		display: flex;
		align-items: center;
		gap: var(--fs-space-2);
		min-width: 0;
		color: var(--fs-admin-muted);
		font-size: 0.8125rem;
	}

	.fs-admin__crumb-sep {
		color: var(--fs-admin-faint);
	}

	.fs-admin__crumb {
		color: var(--fs-admin-muted);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	a.fs-admin__crumb:hover {
		color: var(--fs-admin-text);
	}

	a.fs-admin__crumb:focus-visible {
		outline: none;
		border-radius: var(--fs-radius-sm);
		box-shadow: var(--fs-focus-ring);
	}

	.fs-admin__crumb--current {
		color: var(--fs-admin-text);
		font-weight: 500;
	}

	.fs-admin__header-spacer {
		flex: 1;
	}

	.fs-admin__hamburger {
		display: none;
	}

	/* ---- Sidebar ---- */
	.fs-admin__sidebar {
		grid-column: 1;
		grid-row: 2;
		position: sticky;
		top: var(--fs-header-h);
		align-self: start;
		height: calc(100dvh - var(--fs-header-h));
		overflow-y: auto;
		padding: var(--fs-space-3);
		border-right: 1px solid var(--fs-admin-border);
		background: var(--fs-admin-panel);
		--fs-focus-gap: var(--fs-admin-panel);
	}

	.fs-admin__nav-skeleton {
		display: grid;
		gap: 0.125rem;
	}

	.fs-admin__scrim {
		display: none;
		border: none;
		padding: 0;
	}

	/* ---- Content ---- */
	.fs-admin__content {
		grid-column: 2;
		grid-row: 2;
		min-width: 0;
		padding: var(--fs-space-8);
	}

	.fs-admin__page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--fs-space-3);
		margin-bottom: var(--fs-space-6);
	}

	.fs-admin__page-heading {
		display: grid;
		gap: var(--fs-space-1);
		min-width: 0;
	}

	.fs-admin__title {
		margin: 0;
		color: var(--fs-admin-text-strong);
		font-size: 1.5rem;
		line-height: 2rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		overflow-wrap: anywhere;
	}

	.fs-admin__subtitle {
		margin: 0;
		color: var(--fs-admin-muted);
		font-size: 0.875rem;
	}

	.fs-admin__detail-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--fs-space-2);
		margin: 0;
		color: var(--fs-admin-muted);
		font-size: 0.8125rem;
	}

	.fs-admin__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--fs-space-2);
	}

	.fs-admin__actions .fs-admin__delete-form {
		display: inline-flex;
	}

	/* ---- Index dashboard ---- */
	.fs-admin__dashboard {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: var(--fs-space-4);
		max-width: 60rem;
	}

	.fs-admin__card {
		display: flex;
		align-items: center;
		gap: var(--fs-space-3);
		border: 1px solid var(--fs-admin-border);
		border-radius: var(--fs-radius-md);
		background: var(--fs-admin-panel);
		box-shadow: var(--fs-shadow-sm);
		padding: var(--fs-space-4);
		text-decoration: none;
		color: inherit;
		transition:
			border-color var(--fs-dur) var(--fs-ease),
			box-shadow var(--fs-dur) var(--fs-ease),
			transform var(--fs-dur-fast) var(--fs-ease);
	}

	.fs-admin__card:hover {
		border-color: var(--fs-admin-border-stronger);
		box-shadow: var(--fs-shadow-md);
	}

	.fs-admin__card:focus-visible {
		outline: none;
		box-shadow: var(--fs-focus-ring);
	}

	.fs-admin__card-icon {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
		border-radius: var(--fs-radius-sm);
		background: var(--fs-admin-inset);
		color: var(--fs-admin-muted);
	}

	.fs-admin__card-body {
		display: grid;
		gap: 0.125rem;
		min-width: 0;
		flex: 1;
	}

	.fs-admin__card-title {
		color: var(--fs-admin-text-strong);
		font-size: 0.9375rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fs-admin__card-meta {
		color: var(--fs-admin-muted);
		font-size: 0.8125rem;
	}

	.fs-admin__card-arrow {
		color: var(--fs-admin-faint);
		transition: transform var(--fs-dur) var(--fs-ease);
	}

	.fs-admin__card:hover .fs-admin__card-arrow {
		transform: translateX(2px);
		color: var(--fs-admin-muted);
	}

	/* ---- List view (toolbar + count + pagination) ---- */
	.fs-admin__search {
		position: relative;
		display: flex;
		gap: var(--fs-space-2);
		max-width: 32rem;
		margin-bottom: var(--fs-space-4);
	}

	.fs-admin__search-icon {
		position: absolute;
		left: 0.625rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--fs-admin-faint);
		pointer-events: none;
	}

	.fs-admin__search-input {
		flex: 1;
		min-width: 0;
		padding-left: 2rem;
	}

	.fs-admin__result-count {
		margin: 0 0 var(--fs-space-3);
		color: var(--fs-admin-muted);
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}

	.fs-admin__pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--fs-space-3);
		margin-top: var(--fs-space-4);
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}

	/* ---- Detail definition list ---- */
	.fs-admin__fields {
		margin: 0;
		max-width: 48rem;
		padding: 0;
	}

	.fs-admin__field-row {
		display: grid;
		grid-template-columns: 12rem 1fr;
		gap: var(--fs-space-4);
		padding: 0.875rem 1.25rem;
		border-top: 1px solid var(--fs-admin-border);
	}

	.fs-admin__field-row:first-child {
		border-top: none;
	}

	.fs-admin__field-row dt {
		color: var(--fs-admin-muted);
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.fs-admin__field-row dd {
		margin: 0;
		overflow-wrap: anywhere;
		color: var(--fs-admin-text);
		font-size: 0.875rem;
		line-height: 1.5rem;
	}

	.fs-admin__field-empty {
		color: var(--fs-admin-faint);
	}

	.fs-admin__error-title {
		display: flex;
		align-items: center;
		gap: var(--fs-space-2);
		font-weight: 600;
	}

	/* ---- Forms / detail centering ---- */
	.fs-admin__content :global(.fs-admin__form),
	.fs-admin__fields {
		max-width: 42rem;
	}

	.fs-admin__fields {
		max-width: 48rem;
	}

	/* ---- Responsive: collapse to a drawer ---- */
	@media (max-width: 960px) {
		.fs-admin__shell {
			grid-template-columns: 1fr;
		}

		.fs-admin__hamburger {
			display: inline-flex;
		}

		.fs-admin__sidebar {
			position: fixed;
			top: var(--fs-header-h);
			left: 0;
			z-index: 40;
			width: min(18rem, 80vw);
			height: calc(100dvh - var(--fs-header-h));
			transform: translateX(-100%);
			transition: transform var(--fs-dur-slow) var(--fs-ease);
			box-shadow: var(--fs-shadow-lg);
		}

		.fs-admin--drawer-open .fs-admin__sidebar {
			transform: translateX(0);
		}

		.fs-admin__content {
			grid-column: 1;
		}

		.fs-admin--drawer-open .fs-admin__scrim {
			display: block;
			position: fixed;
			inset: var(--fs-header-h) 0 0;
			z-index: 35;
			background: var(--fs-admin-overlay);
		}
	}

	@media (max-width: 560px) {
		.fs-admin__content {
			padding: var(--fs-space-4);
		}

		.fs-admin__header {
			padding: 0 var(--fs-space-4);
		}

		.fs-admin__breadcrumb {
			display: none;
		}

		.fs-admin__field-row {
			grid-template-columns: 1fr;
			gap: var(--fs-space-1);
		}
	}
</style>
