<script lang="ts">
	import type { CollectionRuntimeConfig } from '@fieldstone/schema';

	import { getCollectionLabel } from './labels';
	import Button from './primitives/Button.svelte';
	import { createFormGuard } from './form-guard.svelte';

	type RemoteFormField = {
		as: (
			type: 'hidden' | 'file' | 'file multiple',
			value?: string | boolean
		) => Record<string, unknown>;
		issues: () => { message: string }[] | undefined;
	};
	type RemoteUploadFields = {
		collection: RemoteFormField;
		file: RemoteFormField;
		allIssues: () => { message: string }[] | undefined;
	};
	type RemoteUploadForm = {
		fields: unknown;
		pending?: number;
	} & Record<string, unknown>;

	let {
		collection,
		form,
		onSuccess
	}: {
		collection: CollectionRuntimeConfig;
		form: RemoteUploadForm;
		onSuccess?: () => void;
	} = $props();

	const fields = $derived(form.fields as RemoteUploadFields);
	// A non-empty mimeTypes list narrows the native file picker; "image/*" etc. pass through.
	const accept = $derived((collection.upload?.mimeTypes ?? []).join(','));
	// The form remounts per route, so capturing form/onSuccess at init is intentional.
	// svelte-ignore state_referenced_locally
	const guard = createFormGuard(form as never, { onSuccess });
</script>

<form class="fs-admin__panel fs-admin__form" enctype="multipart/form-data" {...guard.attrs}>
	<input {...fields.collection.as('hidden', collection.slug)} />

	{#each fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
		<p class="fs-admin__error">{issue.message}</p>
	{/each}

	<div class="fs-admin__field">
		<label class="fs-admin__label" for="upload-file">File</label>
		<input
			id="upload-file"
			class="fs-admin__input"
			type="file"
			required
			accept={accept || undefined}
			{...fields.file.as('file')}
		/>
	</div>

	<div class="fs-admin__form-actions">
		<Button variant="primary" size="lg" disabled={Boolean(form.pending)}>
			Upload {getCollectionLabel(collection, 'singular').toLowerCase()}
		</Button>
	</div>
</form>
