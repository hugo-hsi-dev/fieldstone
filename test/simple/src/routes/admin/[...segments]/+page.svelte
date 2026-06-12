<script lang="ts">
	import '@fieldstone/sveltekit/admin.css';
	import { FieldstoneAdmin } from '@fieldstone/sveltekit/admin';

	import * as remotes from '../dashboard.remote';
</script>

<FieldstoneAdmin {remotes} />
