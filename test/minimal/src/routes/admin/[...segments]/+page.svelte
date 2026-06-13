<script lang="ts">
	import '@fieldstone/ui/admin.css';
	import { FieldstoneAdmin } from '@fieldstone/ui';

	import * as remotes from '../dashboard.remote';
</script>

<FieldstoneAdmin {remotes} />
