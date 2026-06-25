<script lang="ts">
  import { onMount } from "svelte";
  import "@hugo-hsi-dev/ui/admin.css";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import { authClient } from "$lib/auth-client";

  let email = $state("");
  let password = $state("");
  let name = $state("");
  let mode = $state<"signin" | "signup">("signin");
  let error = $state<string | null>(null);
  let pending = $state(false);
  let hydrated = $state(false);

  onMount(() => {
    hydrated = true;
  });

  const redirectTo = $derived.by(() => {
    const target = page.url.searchParams.get("redirect");
    return target && target.startsWith("/") && !target.startsWith("//")
      ? target
      : "/admin";
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    pending = true;
    try {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({
              email,
              password,
              name: name || email,
            })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        error = result.error.message ?? "Authentication failed";
        return;
      }
      await goto(resolve(redirectTo as `/${string}`));
    } catch (caught) {
      error =
        caught instanceof Error ? caught.message : "Authentication failed";
    } finally {
      pending = false;
    }
  }
</script>

<main class="fs-admin login">
  <form class="fs-admin__panel fs-admin__form login__form" onsubmit={submit}>
    <div class="login__heading">
      <p class="login__brand">Fieldstone</p>
      <h1 class="login__title">
        {mode === "signup" ? "Create account" : "Sign in"}
      </h1>
      <p class="fs-admin__muted">
        {mode === "signup"
          ? "Set up your admin account."
          : "Sign in to the admin."}
      </p>
    </div>

    {#if mode === "signup"}
      <label class="login__field">
        <span class="fs-admin__label">Name</span>
        <input class="fs-admin__input" bind:value={name} autocomplete="name" />
      </label>
    {/if}

    <label class="login__field">
      <span class="fs-admin__label">Email</span>
      <input
        class="fs-admin__input"
        type="email"
        bind:value={email}
        autocomplete="email"
        required
      />
    </label>

    <label class="login__field">
      <span class="fs-admin__label">Password</span>
      <input
        class="fs-admin__input"
        type="password"
        bind:value={password}
        autocomplete={mode === "signup" ? "new-password" : "current-password"}
        required
      />
    </label>

    {#if error}
      <div class="fs-admin__error" role="alert"><p>{error}</p></div>
    {/if}

    <button
      type="submit"
      class="fs-admin__button fs-admin__button--primary fs-admin__button--lg"
      disabled={pending || !hydrated}
    >
      {mode === "signup" ? "Sign up" : "Sign in"}
    </button>

    <button
      type="button"
      class="fs-admin__button fs-admin__button--ghost login__toggle"
      onclick={() => (mode = mode === "signup" ? "signin" : "signup")}
    >
      {mode === "signup"
        ? "Have an account? Sign in"
        : "Need an account? Sign up"}
    </button>
  </form>
</main>

<style>
  .login {
    display: grid;
    place-items: center;
    padding: var(--fs-space-6);
  }

  .login__form {
    width: min(100%, 22rem);
  }

  .login__heading,
  .login__field {
    display: grid;
    gap: var(--fs-space-1);
  }

  .login__brand,
  .login__title {
    margin: 0;
    color: var(--fs-admin-text-strong);
  }

  .login__brand {
    font-weight: 600;
  }

  .login__title {
    font-size: 1.375rem;
    line-height: 1.875rem;
    font-weight: 600;
  }

  .login__toggle {
    justify-self: center;
  }
</style>
