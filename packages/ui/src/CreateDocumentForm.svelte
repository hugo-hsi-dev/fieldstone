<script lang="ts">
	import type { CollectionRuntimeConfig } from '@fieldstone/schema';

	import FieldInput from './FieldInput.svelte';
	import { getCollectionLabel } from './labels';
	import Button from './primitives/Button.svelte';
	import { createFormGuard } from './form-guard.svelte';

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
		relationOptions = {},
		onSuccess
	}: {
		collection: CollectionRuntimeConfig;
		form: RemoteForm;
		relationOptions?: Record<string, { value: string; label: string }[]>;
		onSuccess?: () => void;
	} = $props();

	const formFields = $derived(form.fields as RemoteFormFields);
	// The form remounts per route, so capturing form/onSuccess at init is intentional.
	// svelte-ignore state_referenced_locally
	const guard = createFormGuard(form as never, { onSuccess });

	function hasFieldIssues() {
		return collection.fields.some((field) => {
			return (formFields.data[field.identifier]?.issues() ?? []).length > 0;
		});
	}
</script>

<svelte:window
	onbeforeunload={(event) => {
		if (guard.dirty && !guard.submitting) {
			event.preventDefault();
			// Older browsers gate the unsaved-changes prompt on returnValue, not preventDefault.
			event.returnValue = '';
		}
	}}
/>

<form class="fs-admin__panel fs-admin__form" {...guard.attrs} oninput={guard.markDirty}>
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
			options={field.type === 'relationship' || field.type === 'upload'
				? (relationOptions[field.relationTo] ?? [])
				: []}
			{relationOptions}
		/>
	{/each}

	<div class="fs-admin__form-actions">
		<Button variant="primary" size="lg" disabled={Boolean(form.pending)}>
			Create {getCollectionLabel(collection, 'singular').toLowerCase()}
		</Button>
	</div>
</form>
