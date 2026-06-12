import config from '$fieldstone-config';
import { createFieldstoneAdminRemotes } from '@fieldstone/sveltekit/admin/remote';

export const {
	createDocument,
	deleteDocument,
	getAdminIndex,
	getAdminView,
	getDocument,
	listDocuments,
	updateDocument
} = createFieldstoneAdminRemotes({ config });
