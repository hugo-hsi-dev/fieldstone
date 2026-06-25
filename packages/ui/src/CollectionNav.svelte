<script lang="ts">
	import type { CollectionRuntimeConfig, GlobalRuntimeConfig } from '@hugo-hsi-dev/schema';

	import { abbrev, getCollectionLabel, getGlobalLabel } from './labels';

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
					{@const label = getCollectionLabel(navCollection, 'plural')}
					<a
						class={[
							'fs-admin__nav-link',
							navCollection.slug === selectedCollectionSlug && 'fs-admin__nav-link--active'
						]}
						aria-current={navCollection.slug === selectedCollectionSlug ? 'page' : undefined}
						href={collectionHref(navCollection.slug)}
					>
						<span class="fs-admin__nav-chip" aria-hidden="true">{abbrev(label)}</span>
						<span class="fs-admin__nav-label">{label}</span>
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
					{@const label = getGlobalLabel(navGlobal)}
					<a
						class={[
							'fs-admin__nav-link',
							navGlobal.slug === selectedGlobalSlug && 'fs-admin__nav-link--active'
						]}
						aria-current={navGlobal.slug === selectedGlobalSlug ? 'page' : undefined}
						href={globalHref(navGlobal.slug)}
					>
						<span class="fs-admin__nav-chip" aria-hidden="true">{abbrev(label)}</span>
						<span class="fs-admin__nav-label">{label}</span>
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
		gap: var(--fs-space-3);
	}

	.fs-admin__nav-section {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}

	.fs-admin__nav-heading {
		margin: 0;
		padding: var(--fs-space-2) var(--fs-space-2) var(--fs-space-1);
		color: var(--fs-admin-faint);
		font-size: 0.65625rem; /* ~10.5px */
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.fs-admin__nav-links {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}

	.fs-admin__nav-link {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5625rem;
		box-sizing: border-box;
		min-height: 1.9375rem; /* 31px */
		border-radius: var(--fs-radius-md);
		padding: 0 0.5rem;
		color: var(--fs-admin-muted);
		font-size: 0.8125rem;
		font-weight: 500;
		text-decoration: none;
		transition:
			background var(--fs-dur) var(--fs-ease),
			color var(--fs-dur) var(--fs-ease);
	}

	/* Monogram chip — a small rounded square preceding each label */
	.fs-admin__nav-chip {
		display: grid;
		place-items: center;
		flex: none;
		width: 1.125rem;
		height: 1.125rem;
		border-radius: var(--fs-radius-sm);
		background: var(--fs-admin-inset);
		color: var(--fs-admin-muted);
		font-size: 0.5625rem; /* 9px */
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
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

	/* Active row: a filled violet-tint pill, bold label, tinted monogram chip. */
	.fs-admin__nav-link--active,
	.fs-admin__nav-link--active:hover {
		background: var(--fs-admin-accent-bg);
		color: var(--fs-admin-accent-text);
		font-weight: 600;
	}

	.fs-admin__nav-link--active .fs-admin__nav-chip {
		background: var(--fs-admin-accent-tint);
		color: var(--fs-admin-accent);
	}

	.fs-admin__nav-link--active:focus-visible {
		box-shadow: var(--fs-focus-ring);
	}
</style>
