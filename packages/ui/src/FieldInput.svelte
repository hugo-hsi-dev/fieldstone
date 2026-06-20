<script lang="ts">
	import { onMount } from 'svelte';
	import type { CollectionRuntimeConfig, DocumentDataValue } from '@fieldstone/schema';

	import { getFieldLabel, shouldUseTextarea, toDatetimeLocalValue, toInputValue } from './labels';
	import Label from './primitives/Label.svelte';
	import NestedFields from './NestedFields.svelte';
	import Button from './primitives/Button.svelte';
	import Icon from './primitives/Icon.svelte';

	type Field = CollectionRuntimeConfig['fields'][number];

	let {
		field,
		id,
		value = undefined,
		compact = false,
		options = [],
		relationOptions = {},
		formField
	}: {
		field: Field;
		formField: {
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
		id: string;
		value?: DocumentDataValue | undefined;
		compact?: boolean;
		options?: { value: string; label: string }[];
		// Relationship options keyed by target collection slug, for nested
		// relationship fields rendered inside group/array via NestedFields.
		relationOptions?: Record<string, { value: string; label: string }[]>;
	} = $props();

	function defaultOf(target: Field): DocumentDataValue {
		return 'defaultValue' in target && target.defaultValue !== undefined
			? (target.defaultValue as DocumentDataValue)
			: null;
	}

	const base = $derived<DocumentDataValue>(value === undefined ? defaultOf(field) : value);
	const stringValue = $derived(
		field.type === 'date' ? toDatetimeLocalValue(base) : toInputValue(base)
	);
	const placeholder = $derived(field.admin?.placeholder);
	const readOnly = $derived(field.admin?.readOnly ?? false);
	// Show a required marker for scalar fields only (booleans/group/array don't
	// take one). The marker is CSS-only (::after) so it never alters the label's
	// accessible name used by tests.
	const showRequired = $derived(
		Boolean(field.required) && !['boolean', 'group', 'array'].includes(field.type)
	);

	// Drive boolean submission through a reactive hidden input (string "true"/"false")
	// and keep the checkbox as pure UI. This avoids SvelteKit's checkbox value tracking,
	// which does not reflect a document value on the edit form. Seeded identically on the
	// server and client, so there is no hydration mismatch.
	// svelte-ignore state_referenced_locally
	let booleanState = $state(value === undefined ? Boolean(defaultOf(field)) : value === true);

	const relationValues = $derived<string[]>(
		Array.isArray(value) ? value.map(String) : value == null ? [] : [String(value)]
	);

	// Stored ids whose target isn't in the loaded options (hidden by access.read or
	// deleted) still need a selectable option, otherwise saving would silently drop
	// them. Append fallback options for any current id missing from `options`.
	const relationOptionsMerged = $derived.by(() => {
		const present = new Set(options.map((option) => option.value));
		const missing = relationValues
			.filter((id) => id && !present.has(id))
			.map((id) => ({ value: id, label: id }));
		return [...options, ...missing];
	});

	// Rich text: a contenteditable surface bound to local HTML state, submitted via a
	// reactive hidden input (same approach as the checkbox — avoids form value tracking).
	// Stays empty during SSR and is seeded with the sanitized stored value on mount, so
	// untrusted HTML never reaches the server-rendered markup.
	let richTextHtml = $state('');

	// Stored rich-text HTML can originate from another user, an import, or the REST API,
	// so it must be sanitized before it reaches `innerHTML`. Parsing through a detached
	// <template> lets the browser normalize the markup (quoted or unquoted attributes
	// alike), after which we strip dangerous elements, inline event handlers, and unsafe
	// URL protocols. Runs on the client only (it needs the DOM), hence the mount seeding.
	const DANGEROUS_TAGS = /^(?:SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|BASE|FORM|SVG|MATH)$/;
	function sanitizeHtml(html: string): string {
		const template = document.createElement('template');
		template.innerHTML = html;
		for (const element of [...template.content.querySelectorAll('*')]) {
			if (DANGEROUS_TAGS.test(element.tagName)) {
				element.remove();
				continue;
			}
			for (const attr of [...element.attributes]) {
				const name = attr.name.toLowerCase();
				// Strip control chars so an obfuscated protocol can't bypass the URL check
				// below; the control-char range is intentional.
				// eslint-disable-next-line no-control-regex
				const value = attr.value.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
				const isUrlAttr = name === 'href' || name === 'src' || name === 'xlink:href';
				if (name.startsWith('on') || (isUrlAttr && /^(?:javascript|data|vbscript):/.test(value)))
					element.removeAttribute(attr.name);
			}
		}
		return template.innerHTML;
	}

	// Seed once on mount (client-only - sanitizeHtml needs the DOM). Not an $effect, so
	// clearing the editor to empty never re-populates it from the stored value.
	onMount(() => {
		if (field.type === 'richText')
			richTextHtml = sanitizeHtml(typeof base === 'string' ? base : '');
	});

	function execCommand(command: string) {
		document.execCommand(command);
	}

	// Nested fields (group/array) are edited as local state and submitted as JSON via a
	// reactive hidden input.
	// svelte-ignore state_referenced_locally
	let groupState = $state<Record<string, unknown>>(
		field.type === 'group' && base && typeof base === 'object' && !Array.isArray(base)
			? { ...(base as Record<string, unknown>) }
			: {}
	);
	// svelte-ignore state_referenced_locally
	let arrayState = $state<Record<string, unknown>[]>(
		field.type === 'array' && Array.isArray(base)
			? (base as Record<string, unknown>[]).map((entry) => ({ ...entry }))
			: []
	);
	// Stable per-row keys: NestedFields replaces arrayState[index] with a new object
	// on every keystroke, so keying the {#each} by the row object would destroy and
	// recreate the row (dropping focus/caret). These survive object replacement.
	let arrayKeyCounter = 0;
	// svelte-ignore state_referenced_locally
	let arrayKeys = $state<number[]>(arrayState.map(() => arrayKeyCounter++));

	function addArrayRow() {
		arrayState = [...arrayState, {}];
		arrayKeys = [...arrayKeys, arrayKeyCounter++];
	}

	function removeArrayRow(index: number) {
		arrayState = arrayState.filter((_, current) => current !== index);
		arrayKeys = arrayKeys.filter((_, current) => current !== index);
	}
</script>

<div class="fs-admin__field">
	<Label for={id} required={showRequired}>{getFieldLabel(field)}</Label>
	{#if field.admin?.description}
		<p class="fs-admin__field-description">{field.admin.description}</p>
	{/if}
	{#if field.type === 'boolean'}
		<input
			type="hidden"
			name={`data.${field.identifier}`}
			value={booleanState ? 'true' : 'false'}
		/>
		<div class="fs-admin__checkbox-row">
			<input
				class="fs-admin__checkbox"
				type="checkbox"
				bind:checked={booleanState}
				disabled={readOnly}
				{id}
			/>
		</div>
	{:else if field.type === 'select'}
		{#if readOnly}
			<!-- A disabled control is omitted from submission, so carry its value explicitly. -->
			<input type="hidden" name={`data.${field.identifier}`} value={stringValue} />
		{/if}
		<select
			class="fs-admin__select"
			{...formField.as('select', stringValue)}
			{id}
			disabled={readOnly}
		>
			{#if !field.required}
				<option value="">—</option>
			{/if}
			{#each field.options as option (option.value)}
				<option value={option.value} selected={option.value === stringValue}>{option.label}</option>
			{/each}
		</select>
	{:else if field.type === 'relationship' && field.hasMany}
		<!-- Read-only stays enabled so the selected ids still submit through the form's
		     own multi-value name; a disabled multi-select (or duplicate same-name hidden
		     inputs) would drop or be rejected. It's just made non-interactive instead. -->
		<select
			class={['fs-admin__select-multiple', readOnly && 'fs-admin__select-multiple--readonly']}
			multiple
			{...formField.as('select multiple')}
			{id}
			aria-readonly={readOnly}
			tabindex={readOnly ? -1 : undefined}
			onmousedown={readOnly ? (event) => event.preventDefault() : undefined}
			onkeydown={readOnly ? (event) => event.preventDefault() : undefined}
		>
			{#each relationOptionsMerged as option (option.value)}
				<option value={option.value} selected={relationValues.includes(option.value)}
					>{option.label}</option
				>
			{/each}
		</select>
	{:else if field.type === 'relationship'}
		{#if readOnly}
			<input type="hidden" name={`data.${field.identifier}`} value={stringValue} />
		{/if}
		<select
			class="fs-admin__select"
			{...formField.as('select', stringValue)}
			{id}
			disabled={readOnly}
		>
			{#if !field.required}
				<option value="">—</option>
			{/if}
			{#each relationOptionsMerged as option (option.value)}
				<option value={option.value} selected={option.value === stringValue}>{option.label}</option>
			{/each}
		</select>
	{:else if field.type === 'richText'}
		<div class="fs-admin__richtext">
			{#if readOnly}
				<!-- Display-only: render the sanitized HTML without an editable surface. -->
				<div
					{id}
					class="fs-admin__richtext-editor"
					role="textbox"
					aria-readonly="true"
					aria-label={getFieldLabel(field)}
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- richTextHtml is sanitized in sanitizeHtml() -->
					{@html richTextHtml}
				</div>
			{:else}
				<div class="fs-admin__richtext-toolbar">
					<button
						type="button"
						class="fs-admin__richtext-btn"
						aria-label="Bold"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => execCommand('bold')}><strong>B</strong></button
					>
					<button
						type="button"
						class="fs-admin__richtext-btn"
						aria-label="Italic"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => execCommand('italic')}><em>I</em></button
					>
				</div>
				<div
					{id}
					class="fs-admin__richtext-editor"
					contenteditable="true"
					role="textbox"
					aria-multiline="true"
					aria-label={getFieldLabel(field)}
					bind:innerHTML={richTextHtml}
				></div>
			{/if}
			<!-- Read-only submits the original stored value (only the display is
			     sanitized), so saving another field can't overwrite it with stripped HTML. -->
			<input
				type="hidden"
				name={`data.${field.identifier}`}
				value={readOnly ? (typeof base === 'string' ? base : '') : richTextHtml}
			/>
		</div>
	{:else if field.type === 'group'}
		<fieldset class="fs-admin__nested">
			<legend class="fs-admin__nested-legend">{getFieldLabel(field)}</legend>
			<NestedFields
				fields={field.fields}
				bind:value={groupState}
				idPrefix={id}
				{relationOptions}
				{readOnly}
			/>
		</fieldset>
		<input type="hidden" name={`data.${field.identifier}`} value={JSON.stringify(groupState)} />
	{:else if field.type === 'array'}
		<fieldset class="fs-admin__nested">
			<legend class="fs-admin__nested-legend">{getFieldLabel(field)}</legend>
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- keyed by arrayKeys, bound by index -->
			{#each arrayState as entry, index (arrayKeys[index])}
				<div class="fs-admin__array-row">
					<div class="fs-admin__array-row-header">
						<span class="fs-admin__array-index">Item {index + 1}</span>
						{#if !readOnly}
							<Button
								type="button"
								variant="danger-ghost"
								size="sm"
								onclick={() => removeArrayRow(index)}
							>
								Remove
							</Button>
						{/if}
					</div>
					<NestedFields
						fields={field.fields}
						bind:value={arrayState[index]}
						idPrefix={`${id}-${index}`}
						{relationOptions}
						{readOnly}
					/>
				</div>
			{/each}
			{#if !readOnly}
				<button type="button" class="fs-admin__array-add" onclick={addArrayRow}>
					<Icon name="plus" />
					Add item
				</button>
			{/if}
		</fieldset>
		<input type="hidden" name={`data.${field.identifier}`} value={JSON.stringify(arrayState)} />
	{:else if field.type === 'number'}
		<input
			class="fs-admin__input"
			{placeholder}
			readonly={readOnly}
			min={field.min}
			max={field.max}
			step={field.integer ? 1 : 'any'}
			{...formField.as('number', stringValue)}
			{id}
		/>
	{:else if field.type === 'date'}
		<input
			class="fs-admin__input"
			readonly={readOnly}
			step="0.001"
			{...formField.as('datetime-local', stringValue)}
			{id}
		/>
	{:else if field.type === 'email'}
		<input
			class="fs-admin__input"
			{placeholder}
			readonly={readOnly}
			{...formField.as('email', stringValue)}
			{id}
		/>
	{:else if shouldUseTextarea(field)}
		<textarea
			class={['fs-admin__textarea', compact && 'fs-admin__textarea--compact']}
			{placeholder}
			readonly={readOnly}
			{...formField.as('text', stringValue)}
			{id}
		></textarea>
	{:else}
		<input
			class="fs-admin__input"
			{placeholder}
			readonly={readOnly}
			{...formField.as('text', stringValue)}
			{id}
		/>
	{/if}
	{#each formField.issues() ?? [] as issue, index (`${issue.message}-${index}`)}
		<p class="fs-admin__field-error">
			<Icon name="alert" size={13} />
			<span>{issue.message}</span>
		</p>
	{/each}
</div>
