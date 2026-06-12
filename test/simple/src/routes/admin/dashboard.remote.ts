import config from '$fieldstone-config';
import { createAdminRemotes } from '@fieldstone/sveltekit/admin/remote';

export const {
	createDocument,
	deleteDocument,
	getAdminIndex,
	getAdminView,
	getDocument,
	listDocuments,
	updateDocument
} = createAdminRemotes({ config });
