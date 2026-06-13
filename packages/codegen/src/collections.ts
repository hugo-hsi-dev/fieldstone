import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const CMS_DIR = path.join('src', 'cms');
export const COLLECTION_FILENAME = '+collection.ts';

export type CollectionFile = {
	file: string;
	slug: string;
};

export function normalizePath(file: string) {
	return file.split(path.sep).join('/');
}

function isCollectionSource(entry: string) {
	return (
		entry.endsWith('.ts') &&
		!entry.endsWith('.d.ts') &&
		!entry.includes('.test.') &&
		!entry.includes('.spec.')
	);
}

export function isCollectionEntry(entry: string) {
	return !entry.startsWith('_');
}

export function isWatchedCollectionFile(cmsDir: string, file: string) {
	const basename = path.basename(file);
	return (
		file.startsWith(cmsDir) &&
		isCollectionSource(file) &&
		basename === COLLECTION_FILENAME &&
		(!path.basename(path.dirname(file)).startsWith('_') ||
			path.basename(path.dirname(file)) === '__proto__')
	);
}

export function validateCollectionEntries(entries: string[]) {
	const slugs = new Set<string>();

	for (const entry of entries) {
		const slug = entry;
		if (slug === '__proto__') throw new Error('Reserved collection slug: __proto__');
		if (entry.startsWith('_')) continue;

		const normalizedSlug = slug.toLowerCase();
		if (slugs.has(normalizedSlug)) throw new Error(`Duplicate collection slug: ${slug}`);
		slugs.add(normalizedSlug);
	}
}

export function createCollectionScaffold(_slug: string) {
	return `import { collection, text } from '@fieldstone/schema';

export default collection({
\tfields: [
\t\ttext({ name: 'title', required: true })
\t]
});
`;
}

export async function scaffoldCollectionFile(file: string) {
	const source = await readFile(file, 'utf-8');
	if (source.trim()) return false;

	await writeFile(file, createCollectionScaffold(path.basename(file, '.ts')));
	return true;
}

export async function readCollectionEntries(root: string) {
	const cmsDir = path.join(root, CMS_DIR);

	try {
		return await readdir(cmsDir, { withFileTypes: true });
	} catch {
		return [];
	}
}

export async function discoverCollections(root: string): Promise<CollectionFile[]> {
	const cmsDir = path.join(root, CMS_DIR);
	const entries = await readCollectionEntries(root);
	const collectionEntries = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const file = path.join(cmsDir, entry.name, COLLECTION_FILENAME);
		try {
			await access(file);
			collectionEntries.push(entry.name);
		} catch {
			continue;
		}
	}

	collectionEntries.sort();
	validateCollectionEntries(collectionEntries);

	return collectionEntries
		.filter(isCollectionEntry)
		.map((entry) => ({
			file: path.join(cmsDir, entry, COLLECTION_FILENAME),
			slug: entry
		}));
}
