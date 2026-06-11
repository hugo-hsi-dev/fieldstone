<script lang="ts">
	import { resolve } from '$app/paths';

	import {
		cmsConfig,
		getCollectionLabel,
		getFieldLabel,
		type CollectionConfig,
		type CollectionName
	} from '$lib/cms/config';

	import {
		createDocument,
		deleteDocument,
		getDocument,
		listDocuments,
		updateDocument
	} from '../documents.remote';

	let { data }: { data: { collection: CollectionConfig; collectionName: CollectionName } } =
		$props();

	const collection = $derived(data.collection);
	const collectionName = $derived(data.collectionName);
	const documentsQuery = $derived(listDocuments({ collection: collectionName }));

	let editingId = $state<string | null>(null);
	let editData = $state<Record<string, string>>({});
	let errorMessage = $state('');

	function formDataToDocumentData(form: HTMLFormElement) {
		const formData = new FormData(form);
		return Object.fromEntries(
			collection.fields.map((field) => [field.name, String(formData.get(field.name) ?? '')])
		);
	}

	function getFieldValue(document: Record<string, unknown>, fieldName: string) {
		return String(document[fieldName] ?? '');
	}

	function shouldUseTextarea(field: CollectionConfig['fields'][number]) {
		return field.admin?.input === 'textarea';
	}

	async function refreshDocuments() {
		await documentsQuery.refresh();
	}

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';

		const form = event.currentTarget as HTMLFormElement;

		try {
			await createDocument({
				collection: collectionName,
				data: formDataToDocumentData(form)
			});
			form.reset();
			await refreshDocuments();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not create document';
		}
	}

	async function startEdit(id: string) {
		const document = await getDocument({ collection: collectionName, id });
		if (!document) return;

		editingId = document.id;
		editData = Object.fromEntries(
			collection.fields.map((field) => [field.name, getFieldValue(document, field.name)])
		);
	}

	async function handleUpdate(event: SubmitEvent) {
		event.preventDefault();
		if (!editingId) return;
		errorMessage = '';

		try {
			await updateDocument({
				collection: collectionName,
				id: editingId,
				data: editData
			});
			editingId = null;
			await refreshDocuments();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not update document';
		}
	}

	async function handleDelete(id: string) {
		errorMessage = '';

		try {
			await deleteDocument({ collection: collectionName, id });
			if (editingId === id) editingId = null;
			await refreshDocuments();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not delete document';
		}
	}
</script>

<svelte:head>
	<title>Admin | {getCollectionLabel(collection, 'plural')}</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
	<div class="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[20rem_1fr]">
		<section class="space-y-4">
			<div>
				<p class="text-sm font-medium text-zinc-500">CMS</p>
				<h1 class="text-3xl font-semibold tracking-normal">
					{getCollectionLabel(collection, 'plural')}
				</h1>
			</div>

			<nav class="flex flex-wrap gap-2" aria-label="Collections">
				{#each cmsConfig.collections as navCollection (navCollection.slug)}
					<a
						class="rounded-md border px-3 py-2 text-sm font-medium {navCollection.slug ===
						collectionName
							? 'border-zinc-950 bg-zinc-950 text-white'
							: 'border-zinc-300 bg-white hover:bg-zinc-100'}"
						aria-current={navCollection.slug === collectionName ? 'page' : undefined}
						href={resolve(`/admin/${navCollection.slug}`)}
					>
						{getCollectionLabel(navCollection, 'plural')}
					</a>
				{/each}
			</nav>

			<form
				class="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
				onsubmit={handleCreate}
			>
				{#each collection.fields as field (field.name)}
					<div class="space-y-1">
						<label class="text-sm font-medium" for={field.name}>{getFieldLabel(field)}</label>
						{#if shouldUseTextarea(field)}
							<textarea
								class="min-h-32 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
								id={field.name}
								name={field.name}
								required={field.required}
							></textarea>
						{:else}
							<input
								class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
								id={field.name}
								name={field.name}
								required={field.required}
							/>
						{/if}
					</div>
				{/each}

				<button
					class="w-full rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
				>
					Create {getCollectionLabel(collection, 'singular').toLowerCase()}
				</button>
			</form>

			{#if errorMessage}
				<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{errorMessage}
				</p>
			{/if}
		</section>

		<section class="space-y-3">
			{#each await documentsQuery as document (document.id)}
				<article class="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
					{#if editingId === document.id}
						<form class="space-y-3" onsubmit={handleUpdate}>
							{#each collection.fields as field (field.name)}
								<div class="space-y-1">
									<label class="text-sm font-medium" for={`${field.name}-${document.id}`}>
										{getFieldLabel(field)}
									</label>
									{#if shouldUseTextarea(field)}
										<textarea
											class="min-h-28 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
											id={`${field.name}-${document.id}`}
											bind:value={editData[field.name]}
											required={field.required}
										></textarea>
									{:else}
										<input
											class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
											id={`${field.name}-${document.id}`}
											bind:value={editData[field.name]}
											required={field.required}
										/>
									{/if}
								</div>
							{/each}
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
								<h2 class="break-words text-xl font-semibold">
									{getFieldValue(document, collection.fields[0]?.name ?? 'id')}
								</h2>
								{#each collection.fields.slice(1) as field (field.name)}
									<p class="break-words text-sm leading-6 text-zinc-600">
										{getFieldValue(document, field.name)}
									</p>
								{/each}
							</div>
							<div class="flex shrink-0 gap-2">
								<button
									class="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100"
									type="button"
									onclick={() => startEdit(document.id)}
								>
									Edit
								</button>
								<button
									class="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
									type="button"
									onclick={() => handleDelete(document.id)}
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
					No {getCollectionLabel(collection, 'plural').toLowerCase()} yet.
				</div>
			{/each}
		</section>
	</div>
</main>
