<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import { getCollection } from './collections.remote';

	function redirectToCollection(node: HTMLAnchorElement, slug: string) {
		goto(resolve(`/admin/${slug}`), { replaceState: true });
	}
</script>

<svelte:boundary>
	{const collection = await getCollection()}

	{#if collection}
		<main class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
			<a
				class="text-sm font-medium text-zinc-600 underline underline-offset-4"
				href={resolve(`/admin/${collection.slug}`)}
				use:redirectToCollection={collection.slug}
			>
				Open {collection.slug}
			</a>
		</main>
	{:else}
		<main class="min-h-screen bg-zinc-50 px-4 py-8 text-sm text-zinc-600 sm:px-6 lg:px-8">
			No collections found.
		</main>
	{/if}
</svelte:boundary>
