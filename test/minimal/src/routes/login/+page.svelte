<script lang="ts">
	import { onMount } from 'svelte';
	import '@hugo-hsi-dev/ui/admin.css';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	import { authClient } from '$lib/auth-client';

	let email = $state('');
	let password = $state('');
	let name = $state('');
	let mode = $state<'signin' | 'signup'>('signin');
	let error = $state<string | null>(null);
	let pending = $state(false);
	// Gate submission on hydration. The form is JS-only (client-side auth), so a click
	// before the onsubmit handler attaches would fall back to a native GET submit and
	// never sign in — a real cold-load race, not just a test concern.
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});

	// Only honour same-origin absolute paths so `?redirect=` can't become an open
	// redirect (e.g. `//evil.com` or `https://evil.com`).
	const redirectTo = $derived.by(() => {
		const target = page.url.searchParams.get('redirect');
		return target && target.startsWith('/') && !target.startsWith('//') ? target : '/admin';
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		pending = true;
		try {
			const result =
				mode === 'signup'
					? await authClient.signUp.email({ email, password, name: name || email })
					: await authClient.signIn.email({ email, password });
			if (result.error) {
				error = result.error.message ?? 'Authentication failed';
				return;
			}
			await goto(resolve(redirectTo as `/${string}`));
		} finally {
			pending = false;
		}
	}
</script>

<main class="login">
	<form class="login__card" onsubmit={submit}>
		<div class="login__brand">
			<span class="login__brandmark" aria-hidden="true">F</span>
			<span class="login__brand-name">Fieldstone</span>
		</div>

		<div class="login__heading">
			<h1 class="login__title">{mode === 'signup' ? 'Create account' : 'Sign in'}</h1>
			<p class="login__subtitle">
				{mode === 'signup' ? 'Set up your admin account.' : 'Sign in to the admin.'}
			</p>
		</div>

		{#if mode === 'signup'}
			<label class="login__field">
				<span class="login__label">Name</span>
				<input class="login__input" bind:value={name} autocomplete="name" />
			</label>
		{/if}

		<label class="login__field">
			<span class="login__label">Email</span>
			<input class="login__input" type="email" bind:value={email} autocomplete="email" required />
		</label>

		<label class="login__field">
			<span class="login__label">Password</span>
			<input
				class="login__input"
				type="password"
				bind:value={password}
				autocomplete="current-password"
				required
			/>
		</label>

		{#if error}
			<p class="login__error" role="alert">{error}</p>
		{/if}

		<button type="submit" class="login__submit" disabled={pending || !hydrated}>
			{mode === 'signup' ? 'Sign up' : 'Sign in'}
		</button>

		<button
			type="button"
			class="login__toggle"
			onclick={() => (mode = mode === 'signup' ? 'signin' : 'signup')}
		>
			{mode === 'signup' ? 'Have an account? Sign in' : 'Need an account? Sign up'}
		</button>
	</form>
</main>

<style>
	.login {
		display: grid;
		place-items: center;
		min-height: 100dvh;
		padding: 1.5rem;
		background: var(--fs-admin-bg);
		color: var(--fs-admin-text);
		font-family: var(--fs-admin-font-sans);
		font-size: 0.875rem;
		-webkit-font-smoothing: antialiased;
	}

	.login *,
	.login *::before,
	.login *::after {
		box-sizing: border-box;
	}

	.login__card {
		display: grid;
		gap: 1rem;
		width: 100%;
		max-width: 22rem;
		padding: 2rem;
		border: 1px solid var(--fs-admin-border);
		border-radius: var(--fs-radius-lg);
		background: var(--fs-admin-panel);
		box-shadow: var(--fs-shadow-lg);
	}

	.login__brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--fs-admin-text-strong);
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.login__brandmark {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--fs-radius-sm);
		background: var(--fs-admin-primary);
		color: var(--fs-admin-primary-fg);
		font-size: 0.8125rem;
		font-weight: 700;
	}

	.login__heading {
		display: grid;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}

	.login__title {
		margin: 0;
		color: var(--fs-admin-text-strong);
		font-size: 1.375rem;
		line-height: 1.875rem;
		font-weight: 600;
		letter-spacing: -0.014em;
	}

	.login__subtitle {
		margin: 0;
		color: var(--fs-admin-muted);
		font-size: 0.875rem;
	}

	.login__field {
		display: grid;
		gap: 0.375rem;
	}

	.login__label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--fs-admin-text);
	}

	.login__input {
		width: 100%;
		min-height: 2.25rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--fs-admin-border-strong);
		border-radius: var(--fs-radius-sm);
		font: inherit;
		font-size: 0.875rem;
		color: var(--fs-admin-text);
		background: var(--fs-admin-inset);
		transition:
			background var(--fs-dur) var(--fs-ease),
			border-color var(--fs-dur) var(--fs-ease),
			box-shadow var(--fs-dur) var(--fs-ease);
	}

	.login__input:focus {
		outline: none;
		background: var(--fs-admin-panel);
		border-color: var(--fs-admin-ring);
		box-shadow: 0 0 0 3px var(--fs-admin-ring-alpha);
	}

	.login__error {
		margin: 0;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--fs-admin-danger-border);
		border-radius: var(--fs-radius-sm);
		background: var(--fs-admin-danger-bg);
		color: var(--fs-admin-danger);
		font-size: 0.8125rem;
	}

	.login__submit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 2.5rem;
		margin-top: 0.25rem;
		border: 1px solid transparent;
		border-radius: var(--fs-radius-sm);
		background: var(--fs-admin-primary);
		color: var(--fs-admin-primary-fg);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		box-shadow: var(--fs-shadow-sm);
		transition:
			background var(--fs-dur) var(--fs-ease),
			box-shadow var(--fs-dur) var(--fs-ease);
	}

	.login__submit:hover {
		background: var(--fs-admin-primary-hover);
	}

	.login__submit:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px var(--fs-admin-panel),
			0 0 0 4px var(--fs-admin-ring-alpha);
	}

	.login__submit:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.login__toggle {
		justify-self: center;
		padding: 0.25rem 0.5rem;
		border: none;
		border-radius: var(--fs-radius-sm);
		background: none;
		color: var(--fs-admin-muted);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: color var(--fs-dur) var(--fs-ease);
	}

	.login__toggle:hover {
		color: var(--fs-admin-accent);
	}

	.login__toggle:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--fs-admin-panel), 0 0 0 4px var(--fs-admin-ring-alpha);
	}
</style>
