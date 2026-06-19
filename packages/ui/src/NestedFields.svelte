<script lang="ts">
	import type { FieldDefinition } from '@fieldstone/schema';

	import { getFieldLabel } from './labels';
	import Label from './primitives/Label.svelte';

	type Field = FieldDefinition;

	let {
		fields,
		value = $bindable({}),
		idPrefix
	}: {
		fields: Field[];
		value?: Record<string, unknown>;
		idPrefix: string;
	} = $props();

	function setValue(name: string, next: unknown) {
		value = { ...value, [name]: next };
	}
</script>

<div class="fs-admin__nested-fields">
	{#each fields as field (field.name)}
		{@const fieldId = `${idPrefix}-${field.name}`}
		<div class="fs-admin__field">
			<Label for={fieldId}>{getFieldLabel(field)}</Label>
			{#if field.type === 'boolean'}
				<input
					id={fieldId}
					class="fs-admin__checkbox"
					type="checkbox"
					checked={value[field.name] === true}
					onchange={(event) => setValue(field.name, event.currentTarget.checked)}
				/>
			{:else if field.type === 'select'}
				<select
					id={fieldId}
					class="fs-admin__input"
					value={String(value[field.name] ?? '')}
					onchange={(event) => setValue(field.name, event.currentTarget.value)}
				>
					<option value="">—</option>
					{#each field.options as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			{:else if field.type === 'number'}
				<input
					id={fieldId}
					class="fs-admin__input"
					type="number"
					value={value[field.name] ?? ''}
					oninput={(event) =>
						setValue(
							field.name,
							event.currentTarget.value === '' ? null : Number(event.currentTarget.value)
						)}
				/>
			{:else}
				<input
					id={fieldId}
					class="fs-admin__input"
					type={field.type === 'email' ? 'email' : 'text'}
					value={String(value[field.name] ?? '')}
					oninput={(event) => setValue(field.name, event.currentTarget.value)}
				/>
			{/if}
		</div>
	{/each}
</div>

<style>
	.fs-admin__nested-fields {
		display: grid;
		gap: 0.75rem;
	}

	.fs-admin__field {
		display: grid;
		gap: 0.5rem;
	}

	.fs-admin__input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--fs-admin-border-strong);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		font: inherit;
		font-size: 0.875rem;
		color: var(--fs-admin-text);
		background: var(--fs-admin-panel);
	}

	.fs-admin__checkbox {
		width: 1rem;
		height: 1rem;
		accent-color: var(--fs-admin-primary);
	}
</style>
