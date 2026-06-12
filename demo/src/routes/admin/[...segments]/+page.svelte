<script lang="ts">
	import '@fieldstone/sveltekit/admin.css';
	import { AdminDashboard } from '@fieldstone/sveltekit/admin';

	import * as remotes from '../dashboard.remote';
</script>

<AdminDashboard {remotes} />
