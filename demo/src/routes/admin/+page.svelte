<script lang="ts">
	import { createPost, deletePost, getPost, listPosts, updatePost } from './posts.remote';

	const collection = 'posts';
	const postsQuery = listPosts({ collection });

	let editingId = $state<string | null>(null);
	let editTitle = $state('');
	let editDescription = $state('');
	let errorMessage = $state('');

	async function refreshPosts() {
		await postsQuery.refresh();
	}

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';

		const form = event.currentTarget as HTMLFormElement;
		const data = new FormData(form);

		try {
			await createPost({
				collection,
				title: String(data.get('title') ?? ''),
				description: String(data.get('description') ?? '')
			});
			form.reset();
			await refreshPosts();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not create post';
		}
	}

	async function startEdit(id: string) {
		const post = await getPost({ collection, id });
		if (!post) return;

		editingId = post.id;
		editTitle = post.title;
		editDescription = post.description;
	}

	async function handleUpdate(event: SubmitEvent) {
		event.preventDefault();
		if (!editingId) return;
		errorMessage = '';

		try {
			await updatePost({
				collection,
				id: editingId,
				title: editTitle,
				description: editDescription
			});
			editingId = null;
			await refreshPosts();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not update post';
		}
	}

	async function handleDelete(id: string) {
		errorMessage = '';

		try {
			await deletePost({ collection, id });
			if (editingId === id) editingId = null;
			await refreshPosts();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not delete post';
		}
	}
</script>

<svelte:head>
	<title>Admin | Posts</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
	<div class="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[20rem_1fr]">
		<section class="space-y-4">
			<div>
				<p class="text-sm font-medium text-zinc-500">CMS</p>
				<h1 class="text-3xl font-semibold tracking-normal">Posts</h1>
			</div>

			<form
				class="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
				onsubmit={handleCreate}
			>
				<div class="space-y-1">
					<label class="text-sm font-medium" for="title">Title</label>
					<input
						class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
						id="title"
						name="title"
						required
					/>
				</div>

				<div class="space-y-1">
					<label class="text-sm font-medium" for="description">Description</label>
					<textarea
						class="min-h-32 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
						id="description"
						name="description"
						required
					></textarea>
				</div>

				<button
					class="w-full rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
				>
					Create post
				</button>
			</form>

			{#if errorMessage}
				<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{errorMessage}
				</p>
			{/if}
		</section>

		<section class="space-y-3">
			{#each await postsQuery as post (post.id)}
				<article class="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
					{#if editingId === post.id}
						<form class="space-y-3" onsubmit={handleUpdate}>
							<input
								class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium outline-none focus:border-zinc-900"
								bind:value={editTitle}
								required
							/>
							<textarea
								class="min-h-28 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
								bind:value={editDescription}
								required
							></textarea>
							<div class="flex gap-2">
								<button
									class="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
								>
									Save
								</button>
								<button
									class="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100"
									type="button"
									onclick={() => (editingId = null)}
								>
									Cancel
								</button>
							</div>
						</form>
					{:else}
						<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div class="min-w-0 space-y-2">
								<h2 class="break-words text-xl font-semibold">{post.title}</h2>
								<p class="break-words text-sm leading-6 text-zinc-600">{post.description}</p>
							</div>
							<div class="flex shrink-0 gap-2">
								<button
									class="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100"
									type="button"
									onclick={() => startEdit(post.id)}
								>
									Edit
								</button>
								<button
									class="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
									type="button"
									onclick={() => handleDelete(post.id)}
								>
									Delete
								</button>
							</div>
						</div>
					{/if}
				</article>
			{:else}
				<div
					class="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500"
				>
					No posts yet.
				</div>
			{/each}
		</section>
	</div>
</main>
