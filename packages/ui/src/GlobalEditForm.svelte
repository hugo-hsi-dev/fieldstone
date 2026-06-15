<script lang="ts">
	import type { GlobalDocument, GlobalRuntimeConfig, GlobalSlug } from '@fieldstone/schema';

	import FieldInput from './FieldInput.svelte';
	import { getFieldInputValue, getGlobalLabel } from './labels';
	import Button from './primitives/Button.svelte';

	type RemoteFormField = {
		as: (type: 'checkbox' | 'hidden' | 'text', value?: string) => Record<string, unknown>;
		issues: () => { message: string }[] | undefined;
	};

	type RemoteFormFields = {
		global: RemoteFormField;
		data: Record<string, RemoteFormField>;
		allIssues: () => { message: string }[] | undefined;
	};

	type RemoteForm = {
		fields: unknown;
		pending?: number;
	} & Record<string, unknown>;

	let {
		globalConfig,
		document,
		form
	}: {
		globalConfig: GlobalRuntimeConfig;
		document: GlobalDocument<GlobalSlug> | null;
		form: RemoteForm;
	} = $props();

	const formFields = $derived(form.fields as RemoteFormFields);

	function hasFieldIssues() {
		return globalConfig.fields.some((field) => {
			return (formFields.data[field.identifier]?.issues() ?? []).length > 0;
		});
	}
</script>

<form class="fs-admin__panel fs-admin__form" {...form}>
	<input {...formFields.global.as('hidden', globalConfig.slug)} />

	{#if !hasFieldIssues()}
		{#each formFields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
			<p class="fs-admin__error">{issue.message}</p>
		{/each}
	{/if}

	{#each globalConfig.fields as field (field.name)}
		<FieldInput
			{field}
			formField={formFields.data[field.identifier]}
			id={`global-${globalConfig.slug}-${field.identifier}`}
			value={getFieldInputValue(document, field.name)}
			compact
		/>
	{/each}

	<Button variant="primary" disabled={Boolean(form.pending)}>
		Save {getGlobalLabel(globalConfig).toLowerCase()}
	</Button>
</form>

<style>
	.fs-admin__form {
		display: grid;
		gap: 1rem;
	}

	.fs-admin__panel {
		border: 1px solid var(--fs-admin-border);
		border-radius: 0.5rem;
		background: var(--fs-admin-panel);
		padding: 1rem;
	}

	.fs-admin__error {
		border: 1px solid var(--fs-admin-danger-border);
		border-radius: 0.5rem;
		background: var(--fs-admin-danger-bg);
		color: var(--fs-admin-danger);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}
</style>
