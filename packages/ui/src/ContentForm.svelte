<script lang="ts">
	import type { CollectionRuntimeField, DocumentDataValue } from '@hugo-hsi-dev/schema';

	import FieldInput from './FieldInput.svelte';
	import Button from './primitives/Button.svelte';
	import { createFormGuard } from './form-guard.svelte';
	import type { RemoteForm, RemoteFormField, RemoteFormFields } from './remotes';

	let {
		cancelHref = undefined,
		compact = false,
		fields,
		form,
		hidden,
		idPrefix,
		onSuccess,
		relationOptions = {},
		submitLabel,
		values = {}
	}: {
		cancelHref?: string;
		compact?: boolean;
		fields: readonly CollectionRuntimeField[];
		form: RemoteForm;
		hidden: { field: RemoteFormField; value: string }[];
		idPrefix: string;
		onSuccess?: () => void;
		relationOptions?: Record<string, { value: string; label: string }[]>;
		submitLabel: string;
		values?: Record<string, DocumentDataValue | undefined>;
	} = $props();

	const formFields = $derived(form.fields as RemoteFormFields);
	// The form remounts per route, so capturing form/onSuccess at init is intentional.
	// svelte-ignore state_referenced_locally
	const guard = createFormGuard(form as never, { onSuccess });

	function hasFieldIssues() {
		return fields.some((field) => {
			return (formFields.data[field.identifier]?.issues() ?? []).length > 0;
		});
	}
</script>

<form class="fs-admin__panel fs-admin__form" {...guard.attrs} oninput={guard.markDirty}>
	{#each hidden as input, index (`${input.value}-${index}`)}
		<input {...input.field.as('hidden', input.value)} />
	{/each}

	{#if !hasFieldIssues()}
		{#each formFields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
			<p class="fs-admin__error">{issue.message}</p>
		{/each}
	{/if}

	{#each fields as field (field.name)}
		<FieldInput
			{field}
			formField={formFields.data[field.identifier]}
			id={`${idPrefix}-${field.identifier}`}
			value={values[field.name]}
			options={field.type === 'relationship' || field.type === 'upload'
				? (relationOptions[field.relationTo] ?? [])
				: []}
			{relationOptions}
			{compact}
		/>
	{/each}

	<div class="fs-admin__form-actions">
		<Button variant="primary" size="lg" disabled={Boolean(form.pending)}>{submitLabel}</Button>
		{#if cancelHref}
			<Button variant="ghost" href={cancelHref}>Cancel</Button>
		{/if}
	</div>
</form>
