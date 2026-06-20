<script lang="ts">
	import type { CollectionRuntimeConfig } from '@fieldstone/schema';

	import FieldInput from './FieldInput.svelte';
	import { getCollectionLabel } from './labels';
	import Button from './primitives/Button.svelte';

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
		data: Record<string, RemoteFormField>;
		allIssues: () => { message: string }[] | undefined;
	};

	type RemoteForm = {
		fields: unknown;
		pending?: number;
	} & Record<string, unknown>;

	let {
		collection,
		form,
		relationOptions = {}
	}: {
		collection: CollectionRuntimeConfig;
		form: RemoteForm;
		relationOptions?: Record<string, { value: string; label: string }[]>;
	} = $props();

	const formFields = $derived(form.fields as RemoteFormFields);

	function hasFieldIssues() {
		return collection.fields.some((field) => {
			return (formFields.data[field.identifier]?.issues() ?? []).length > 0;
		});
	}
</script>

<form class="fs-admin__panel fs-admin__form" {...form}>
	<input {...formFields.collection.as('hidden', collection.slug)} />

	{#if !hasFieldIssues()}
		{#each formFields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
			<p class="fs-admin__error">{issue.message}</p>
		{/each}
	{/if}

	{#each collection.fields as field (field.name)}
		<FieldInput
			{field}
			formField={formFields.data[field.identifier]}
			id={`create-${collection.slug}-${field.identifier}`}
			options={field.type === 'relationship' ? (relationOptions[field.relationTo] ?? []) : []}
			{relationOptions}
		/>
	{/each}

	<div class="fs-admin__form-actions">
		<Button variant="primary" size="lg" disabled={Boolean(form.pending)}>
			Create {getCollectionLabel(collection, 'singular').toLowerCase()}
		</Button>
	</div>
</form>
