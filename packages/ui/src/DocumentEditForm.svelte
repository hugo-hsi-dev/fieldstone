<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		CollectionDocument,
		CollectionRuntimeConfig,
		CollectionSlug
	} from '@fieldstone/schema';

	import FieldInput from './FieldInput.svelte';
	import { getCollectionLabel, getFieldInputValue } from './labels';
	import Button from './primitives/Button.svelte';
	import { adminDocumentPath, adminRouteId, adminRouteSegments } from '@fieldstone/routes';

	type RemoteFormField = {
		as: (
			type:
				| 'checkbox'
				| 'hidden'
				| 'text'
				| 'email'
				| 'number'
				| 'date'
				| 'datetime-local'
				| 'select'
				| 'select multiple',
			value?: string | boolean
		) => Record<string, unknown>;
		issues: () => { message: string }[] | undefined;
	};

	type RemoteFormFields = {
		collection: RemoteFormField;
		id: RemoteFormField;
		data: Record<string, RemoteFormField>;
		allIssues: () => { message: string }[] | undefined;
	};

	type RemoteForm = {
		fields: unknown;
		pending?: number;
	} & Record<string, unknown>;

	let {
		collection,
		document,
		form,
		relationOptions = {}
	}: {
		collection: CollectionRuntimeConfig;
		document: CollectionDocument<CollectionSlug>;
		form: RemoteForm;
		relationOptions?: Record<string, { value: string; label: string }[]>;
	} = $props();

	const formFields = $derived(form.fields as RemoteFormFields);

	function hasFieldIssues() {
		return collection.fields.some((field) => {
			return (formFields.data[field.identifier]?.issues() ?? []).length > 0;
		});
	}

	function resolveAdminPath(path: string) {
		return resolve(adminRouteId, { segments: adminRouteSegments(path) });
	}
</script>

<form class="fs-admin__panel fs-admin__form" {...form}>
	<input {...formFields.collection.as('hidden', collection.slug)} />
	<input {...formFields.id.as('hidden', document.id)} />

	{#if !hasFieldIssues()}
		{#each formFields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
			<p class="fs-admin__error">{issue.message}</p>
		{/each}
	{/if}

	{#each collection.fields as field (field.name)}
		<FieldInput
			{field}
			formField={formFields.data[field.identifier]}
			id={`edit-${document.id}-${field.identifier}`}
			value={getFieldInputValue(document, field.name)}
			options={field.type === 'relationship' ? (relationOptions[field.relationTo] ?? []) : []}
			{relationOptions}
			compact
		/>
	{/each}

	<div class="fs-admin__form-actions">
		<Button variant="primary" size="lg" disabled={Boolean(form.pending)}>
			Save {getCollectionLabel(collection, 'singular').toLowerCase()}
		</Button>
		<Button
			variant="ghost"
			href={resolveAdminPath(adminDocumentPath(collection.slug, document.id))}
		>
			Cancel
		</Button>
	</div>
</form>
