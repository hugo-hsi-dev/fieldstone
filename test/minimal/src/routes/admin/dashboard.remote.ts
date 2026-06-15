import config from '$fieldstone-config';
import { createFieldstoneAdminRemotes } from '@fieldstone/remotes';

export const {
	createDocument,
	deleteDocument,
	getCollection,
	getDocument,
	getGlobal,
	getGlobalConfig,
	listCollections,
	listDocuments,
	listGlobals,
	updateDocument,
	updateGlobal
} = createFieldstoneAdminRemotes({ config });
