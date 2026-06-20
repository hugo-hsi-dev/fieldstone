<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<!-- Resolves the light/dark theme before paint (FOUC-free) and keeps it in sync
     with the OS preference + the admin's theme toggle. -->
<ModeWatcher />

{@render children()}
