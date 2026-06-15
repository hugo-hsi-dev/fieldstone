<script lang="ts">
	import type { CollectionRuntimeConfig, GlobalRuntimeConfig } from '@fieldstone/schema';

	import { getCollectionLabel, getGlobalLabel } from './labels';

	let {
		collections,
		collectionHref,
		globals = [],
		globalHref,
		selectedCollectionSlug,
		selectedGlobalSlug = null
	}: {
		collections: CollectionRuntimeConfig[];
		collectionHref: (slug: string) => string;
		globals?: GlobalRuntimeConfig[];
		globalHref?: (slug: string) => string;
		selectedCollectionSlug: string | null;
		selectedGlobalSlug?: string | null;
	} = $props();
</script>

<nav class="fs-admin__nav" aria-label="CMS content">
	{#if collections.length}
		<div class="fs-admin__nav-section">
			<p class="fs-admin__nav-heading">Collections</p>
			<div class="fs-admin__nav-links">
				{#each collections as navCollection (navCollection.slug)}
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
			</div>
		</div>
	{/if}

	{#if globals.length && globalHref}
		<div class="fs-admin__nav-section">
			<p class="fs-admin__nav-heading">Globals</p>
			<div class="fs-admin__nav-links">
				{#each globals as navGlobal (navGlobal.slug)}
					<a
						class={[
							'fs-admin__nav-link',
							navGlobal.slug === selectedGlobalSlug && 'fs-admin__nav-link--active'
						]}
						aria-current={navGlobal.slug === selectedGlobalSlug ? 'page' : undefined}
						href={globalHref(navGlobal.slug)}
					>
						{getGlobalLabel(navGlobal)}
					</a>
				{/each}
			</div>
		</div>
	{/if}
</nav>

<style>
	.fs-admin__nav,
	.fs-admin__nav-section,
	.fs-admin__nav-links {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.fs-admin__nav,
	.fs-admin__nav-section {
		flex-direction: column;
	}

	.fs-admin__nav-heading {
		margin: 0;
		color: var(--fs-admin-muted);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.fs-admin__nav-link {
		display: inline-flex;
		align-items: center;
		box-sizing: border-box;
		min-height: 2.5rem;
		border: 1px solid var(--fs-admin-border-strong);
		border-radius: 0.375rem;
		background: var(--fs-admin-panel);
		color: var(--fs-admin-text);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
	}

	.fs-admin__nav-link:hover {
		background: #f4f4f5;
	}

	.fs-admin__nav-link--active {
		border-color: var(--fs-admin-primary);
		background: var(--fs-admin-primary);
		color: white;
	}

	.fs-admin__nav-link--active:hover {
		background: var(--fs-admin-primary-hover);
	}
</style>
