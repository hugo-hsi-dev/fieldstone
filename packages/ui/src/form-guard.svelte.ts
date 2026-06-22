import { beforeNavigate } from '$app/navigation';

type SubmittableForm = {
	enhance(
		callback: (form: { submit(): Promise<boolean> }) => void | Promise<void>
	): Record<string, unknown>;
};

export type FormGuard = {
	/** Spread onto the `<form>` element to enhance it. */
	readonly attrs: Record<string, unknown>;
	/** Wire to the form's `oninput` so edits flip the dirty flag. */
	markDirty: () => void;
	/** True when the form has unsaved edits. */
	readonly dirty: boolean;
	/** True while a submission (and any success redirect) is in flight. */
	readonly submitting: boolean;
};

/**
 * Enhances a remote form with a success hook and an unsaved-changes guard.
 *
 * - On a successful submit, runs `onSuccess` (e.g. to show a toast). A submit that
 *   fails validation re-arms the dirty flag instead of reporting success.
 * - Registers a `beforeNavigate` guard that confirms before discarding unsaved edits.
 *   The `submitting` flag lets the redirect a successful save triggers through without
 *   prompting.
 *
 * Call once during component init — it registers a navigation lifecycle hook.
 */
export function createFormGuard(
	form: SubmittableForm,
	options: { onSuccess?: () => void } = {}
): FormGuard {
	let dirty = $state(false);
	let submitting = $state(false);

	beforeNavigate((navigation) => {
		if (!dirty || submitting) return;
		if (!window.confirm('You have unsaved changes. Leave without saving?')) {
			navigation.cancel();
		}
	});

	const attrs = form.enhance(async (enhanced) => {
		submitting = true;
		// Clear up-front so the redirect a successful submit triggers isn't caught by
		// the navigation guard above.
		dirty = false;
		try {
			const ok = await enhanced.submit();
			if (ok) options.onSuccess?.();
			else dirty = true;
		} finally {
			submitting = false;
		}
	});

	return {
		attrs,
		markDirty: () => {
			dirty = true;
		},
		get dirty() {
			return dirty;
		},
		get submitting() {
			return submitting;
		}
	};
}
