<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import type { FieldDefinition } from '@hugo-hsi-dev/schema';

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

	function requiredOf(field: Field): boolean {
		return (
			'required' in field &&
			Boolean(field.required) &&
			!['boolean', 'group', 'array'].includes(field.type)
		);
	}
</script>

<div class="fs-admin__nested-fields">
	{#each fields as field (field.name)}
		{@const fieldId = `${idPrefix}-${field.name}`}
		{@const readOnly = readOnlyOf(field)}
		<div class="fs-admin__field">
			<Label for={fieldId} required={requiredOf(field)}>{getFieldLabel(field)}</Label>
			{#if field.type === 'boolean'}
				<div class="fs-admin__checkbox-row">
					<input
						id={fieldId}
						class="fs-admin__checkbox"
						type="checkbox"
						checked={value[field.name] === undefined
							? field.defaultValue === true
							: value[field.name] === true}
						disabled={readOnly}
						onchange={(event) => setValue(field.name, event.currentTarget.checked)}
					/>
				</div>
			{:else if field.type === 'select'}
				<select
					id={fieldId}
					class="fs-admin__select"
					value={String(value[field.name] ?? field.defaultValue ?? '')}
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
					class="fs-admin__select-multiple"
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
					class="fs-admin__select"
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
							<div class="fs-admin__array-row-header">
								<span class="fs-admin__array-index">Item {index + 1}</span>
								{#if !readOnly}
									<Button
										type="button"
										variant="danger-ghost"
										size="sm"
										onclick={() => removeArrayRow(field.name, index)}
									>
										Remove
									</Button>
								{/if}
							</div>
							<NestedFields
								fields={field.fields}
								value={entry}
								idPrefix={`${fieldId}-${index}`}
								{relationOptions}
								{readOnly}
								onUpdate={(next) => setArrayRow(field.name, index, next)}
							/>
						</div>
					{/each}
					{#if !readOnly}
						<button
							type="button"
							class="fs-admin__array-add"
							onclick={() => addArrayRow(field.name)}
						>
							<Plus size={16} class="fs-admin__icon" aria-hidden="true" focusable="false" />
							Add item
						</button>
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
