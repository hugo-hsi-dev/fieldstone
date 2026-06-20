<script lang="ts">
	import type { CollectionRuntimeConfig, GlobalRuntimeConfig } from '@fieldstone/schema';

	import { getCollectionLabel, getGlobalLabel } from './labels';
	import Icon from './primitives/Icon.svelte';

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
						<Icon name="collection" class="fs-admin__nav-icon" />
						<span class="fs-admin__nav-label">{getCollectionLabel(navCollection, 'plural')}</span>
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
						<Icon name="globe" class="fs-admin__nav-icon" />
						<span class="fs-admin__nav-label">{getGlobalLabel(navGlobal)}</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</nav>

<style>
	.fs-admin__nav {
		display: flex;
		flex-direction: column;
		gap: var(--fs-space-5);
	}

	.fs-admin__nav-section {
		display: flex;
		flex-direction: column;
		gap: var(--fs-space-1);
	}

	.fs-admin__nav-heading {
		margin: 0;
		padding: 0 var(--fs-space-2) var(--fs-space-1);
		color: var(--fs-admin-faint);
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.fs-admin__nav-links {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.fs-admin__nav-link {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		box-sizing: border-box;
		min-height: 2rem;
		border-radius: var(--fs-radius-sm);
		padding: 0 0.625rem;
		color: var(--fs-admin-muted);
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		transition:
			background var(--fs-dur) var(--fs-ease),
			color var(--fs-dur) var(--fs-ease);
	}

	.fs-admin__nav-link :global(.fs-admin__nav-icon) {
		opacity: 0.85;
	}

	.fs-admin__nav-label {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.fs-admin__nav-link:hover {
		background: var(--fs-admin-hover);
		color: var(--fs-admin-text);
	}

	.fs-admin__nav-link:focus-visible {
		outline: none;
		box-shadow: var(--fs-focus-ring);
	}

	.fs-admin__nav-link--active,
	.fs-admin__nav-link--active:hover {
		background: var(--fs-admin-accent-bg);
		color: var(--fs-admin-accent);
		font-weight: 600;
		/* 2px left accent bar — location never depends on the tint contrast */
		box-shadow: inset 2px 0 0 var(--fs-admin-accent);
	}

	/* Keep the accent bar when the active link is keyboard-focused (box-shadow
	   does not merge, so combine the bar with the focus ring explicitly). */
	.fs-admin__nav-link--active:focus-visible {
		box-shadow:
			inset 2px 0 0 var(--fs-admin-accent),
			var(--fs-focus-ring);
	}
</style>
