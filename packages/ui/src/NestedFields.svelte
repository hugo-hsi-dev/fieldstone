<script lang="ts">
	import type { FieldDefinition } from '@fieldstone/schema';

	import { getFieldLabel } from './labels';
	import Label from './primitives/Label.svelte';
	import Button from './primitives/Button.svelte';
	import NestedFields from './NestedFields.svelte';

	type Field = FieldDefinition;

	let {
		fields,
		value = $bindable({}),
		idPrefix,
		relationOptions = {},
		readOnly = false,
		onUpdate
	}: {
		fields: Field[];
		value?: Record<string, unknown>;
		idPrefix: string;
		// Relationship options keyed by target collection slug.
		relationOptions?: Record<string, { value: string; label: string }[]>;
		// When the parent group/array field is read-only, force every nested control
		// inert so saving can't mutate read-only grouped data.
		readOnly?: boolean;
		// Called on every change so nested group/array levels can bubble updates up
		// (the top level is driven by bind:value from FieldInput instead).
		onUpdate?: (next: Record<string, unknown>) => void;
	} = $props();

	function relationValuesOf(raw: unknown): string[] {
		if (Array.isArray(raw)) return raw.map(String);
		return raw == null ? [] : [String(raw)];
	}

	// Loaded options plus fallback entries for current ids missing from them (hidden
	// by access or deleted), so a nested relationship stays a constrained select and
	// never drops stored ids on save.
	function mergeRelationOptions(relationTo: string, ids: string[]) {
		const opts = relationOptions[relationTo] ?? [];
		const present = new Set(opts.map((option) => option.value));
		const missing = ids
			.filter((id) => id && !present.has(id))
			.map((id) => ({ value: id, label: id }));
		return [...opts, ...missing];
	}

	function setValue(name: string, next: unknown) {
		value = { ...value, [name]: next };
		onUpdate?.(value);
	}

	function asRecord(raw: unknown): Record<string, unknown> {
		return raw && typeof raw === 'object' && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {};
	}

	function asArray(raw: unknown): Record<string, unknown>[] {
		return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
	}

	function setArrayRow(name: string, index: number, next: Record<string, unknown>) {
		const list = asArray(value[name]).slice();
		list[index] = next;
		setValue(name, list);
	}

	function addArrayRow(name: string) {
		setValue(name, [...asArray(value[name]), {}]);
	}

	function removeArrayRow(name: string, index: number) {
		setValue(
			name,
			asArray(value[name]).filter((_, current) => current !== index)
		);
	}

	function readOnlyOf(field: Field): boolean {
		return readOnly || field.admin?.readOnly === true;
	}
</script>

<div class="fs-admin__nested-fields">
	{#each fields as field (field.name)}
		{@const fieldId = `${idPrefix}-${field.name}`}
		{@const readOnly = readOnlyOf(field)}
		<div class="fs-admin__field">
			<Label for={fieldId}>{getFieldLabel(field)}</Label>
			{#if field.type === 'boolean'}
				<input
					id={fieldId}
					class="fs-admin__checkbox"
					type="checkbox"
					checked={value[field.name] === true}
					disabled={readOnly}
					onchange={(event) => setValue(field.name, event.currentTarget.checked)}
				/>
			{:else if field.type === 'select'}
				<select
					id={fieldId}
					class="fs-admin__input"
					value={String(value[field.name] ?? '')}
					disabled={readOnly}
					onchange={(event) => setValue(field.name, event.currentTarget.value)}
				>
					<option value="">—</option>
					{#each field.options as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			{:else if field.type === 'relationship' && field.hasMany}
				{@const selected = relationValuesOf(value[field.name])}
				{@const opts = mergeRelationOptions(field.relationTo, selected)}
				<select
					id={fieldId}
					class="fs-admin__input"
					multiple
					disabled={readOnly}
					onchange={(event) =>
						setValue(
							field.name,
							Array.from(event.currentTarget.selectedOptions, (option) => option.value)
						)}
				>
					{#each opts as option (option.value)}
						<option value={option.value} selected={selected.includes(option.value)}
							>{option.label}</option
						>
					{/each}
				</select>
			{:else if field.type === 'relationship'}
				{@const current = value[field.name] == null ? '' : String(value[field.name])}
				{@const opts = mergeRelationOptions(field.relationTo, current ? [current] : [])}
				<!-- Always a constrained select (never free text), so only known/fallback
				     ids can be entered. -->
				<select
					id={fieldId}
					class="fs-admin__input"
					value={current}
					disabled={readOnly}
					onchange={(event) => setValue(field.name, event.currentTarget.value || null)}
				>
					<option value="">—</option>
					{#each opts as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			{:else if field.type === 'group'}
				<fieldset class="fs-admin__nested">
					<NestedFields
						fields={field.fields}
						value={asRecord(value[field.name])}
						idPrefix={fieldId}
						{relationOptions}
						{readOnly}
						onUpdate={(next) => setValue(field.name, next)}
					/>
				</fieldset>
			{:else if field.type === 'array'}
				<fieldset class="fs-admin__nested">
					{#each asArray(value[field.name]) as entry, index (index)}
						<div class="fs-admin__array-row">
							<NestedFields
								fields={field.fields}
								value={entry}
								idPrefix={`${fieldId}-${index}`}
								{relationOptions}
								{readOnly}
								onUpdate={(next) => setArrayRow(field.name, index, next)}
							/>
							{#if !readOnly}
								<Button type="button" onclick={() => removeArrayRow(field.name, index)}
									>Remove</Button
								>
							{/if}
						</div>
					{/each}
					{#if !readOnly}
						<Button type="button" onclick={() => addArrayRow(field.name)}>Add item</Button>
					{/if}
				</fieldset>
			{:else if field.type === 'number'}
				<input
					id={fieldId}
					class="fs-admin__input"
					type="number"
					value={value[field.name] ?? ''}
					readonly={readOnly}
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
					readonly={readOnly}
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

	.fs-admin__nested {
		display: grid;
		gap: 0.75rem;
		border: 1px solid var(--fs-admin-border);
		border-radius: 0.5rem;
		padding: 0.75rem;
		margin: 0;
	}

	.fs-admin__array-row {
		display: grid;
		gap: 0.5rem;
		border-top: 1px solid var(--fs-admin-border);
		padding-top: 0.75rem;
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
