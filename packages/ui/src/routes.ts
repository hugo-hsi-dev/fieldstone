export {
	adminCollectionPath,
	adminDocumentPath,
	adminEditDocumentPath,
	adminGlobalPath,
	adminIndexPath,
	adminNewDocumentPath,
	adminRouteId,
	adminRouteSegments,
	resolveAdminPath
} from '@hugo-hsi-dev/admin-runtime/admin-paths';

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
	| { global: string; type: 'globalEdit' }
	| { type: 'notFound' };

export function parseAdminRoute(segments: string[]): AdminRoute {
	if (segments.length === 0) return { type: 'index' };
	if (segments[0] === 'globals') {
		const global = segments[1];
		if (!global || segments.length !== 2) return { type: 'notFound' };
		return { global, type: 'globalEdit' };
	}
	if (segments[0] !== 'collections') return { type: 'notFound' };

	const collection = segments[1];
	if (!collection) return { type: 'notFound' };
	if (segments.length === 2) return { collection, type: 'collectionList' };
	if (segments.length === 3 && segments[2] === 'new') return { collection, type: 'collectionNew' };

	const id = segments[2];
	if (!id) return { type: 'notFound' };
	if (segments.length === 3) return { collection, id, type: 'documentDetail' };
	if (segments.length === 4 && segments[3] === 'edit')
		return { collection, id, type: 'documentEdit' };

	return { type: 'notFound' };
}

export const DEFAULT_MEDIA_PREFIX = '/media';

export function mediaPath(key: string, prefix: string = DEFAULT_MEDIA_PREFIX) {
	const base = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
	const encoded = key
		.split('/')
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return `${base}/${encoded}`;
}
