<script lang="ts">
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
	<form class="login__form" onsubmit={submit}>
		<h1>{mode === 'signup' ? 'Create account' : 'Sign in'}</h1>

		{#if mode === 'signup'}
			<label>
				Name
				<input bind:value={name} autocomplete="name" />
			</label>
		{/if}

		<label>
			Email
			<input type="email" bind:value={email} autocomplete="email" required />
		</label>

		<label>
			Password
			<input type="password" bind:value={password} autocomplete="current-password" required />
		</label>

		{#if error}
			<p class="login__error">{error}</p>
		{/if}

		<button type="submit" disabled={pending}>
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
		max-width: 22rem;
		margin: 4rem auto;
		font-family: system-ui, sans-serif;
	}

	.login__form {
		display: grid;
		gap: 0.75rem;
	}

	.login__form label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.875rem;
	}

	.login__form input {
		padding: 0.5rem 0.75rem;
		border: 1px solid #d4d4d8;
		border-radius: 0.375rem;
		font: inherit;
	}

	.login__error {
		color: #dc2626;
		font-size: 0.875rem;
	}
</style>
