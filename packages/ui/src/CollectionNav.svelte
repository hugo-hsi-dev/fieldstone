<script lang="ts">
	import type { CollectionRuntimeConfig } from '@fieldstone/schema';

	import { getCollectionLabel } from './labels';

	let {
		collections,
		collectionHref,
		selectedCollectionSlug
	}: {
		collections: CollectionRuntimeConfig[];
		collectionHref: (slug: string) => string;
		selectedCollectionSlug: string | null;
	} = $props();
</script>

<nav class="fs-admin__nav" aria-label="Collections">
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
</nav>

<style>
	.fs-admin__nav {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.5rem;
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
