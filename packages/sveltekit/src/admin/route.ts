export function getAdminSegments(pathname: string) {
	const parts = pathname.split('/').filter(Boolean);
	const adminIndex = parts.findIndex((part) => part === 'admin');
	if (adminIndex === -1) return [];

	return parts.slice(adminIndex + 1).map((part) => decodeURIComponent(part));
}

export type AdminRoute =
	| { type: 'index' }
	| { collection: string; type: 'collectionList' }
	| { collection: string; type: 'collectionNew' }
	| { collection: string; id: string; type: 'documentDetail' }
	| { collection: string; id: string; type: 'documentEdit' }
	| { type: 'notFound' };

export function parseAdminRoute(segments: string[]): AdminRoute {
	if (segments.length === 0) return { type: 'index' };
	if (segments[0] !== 'collections') return { type: 'notFound' };

	const collection = segments[1];
	if (!collection) return { type: 'notFound' };
	if (segments.length === 2) return { collection, type: 'collectionList' };
	if (segments.length === 3 && segments[2] === 'new') return { collection, type: 'collectionNew' };

	const id = segments[2];
	if (!id) return { type: 'notFound' };
	if (segments.length === 3) return { collection, id, type: 'documentDetail' };
	if (segments.length === 4 && segments[3] === 'edit') return { collection, id, type: 'documentEdit' };

	return { type: 'notFound' };
}

export function adminCollectionPath(collection: string) {
	return `/admin/collections/${encodeURIComponent(collection)}`;
}

export function adminNewDocumentPath(collection: string) {
	return `${adminCollectionPath(collection)}/new`;
}

export function adminDocumentPath(collection: string, id: string) {
	return `${adminCollectionPath(collection)}/${encodeURIComponent(id)}`;
}

export function adminEditDocumentPath(collection: string, id: string) {
	return `${adminDocumentPath(collection, id)}/edit`;
}
