import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
	return isCollectionSource(entry) && !entry.startsWith('_');
}

export function isWatchedCollectionFile(collectionsDir: string, file: string) {
	const basename = path.basename(file);
	return (
		file.startsWith(collectionsDir) &&
		isCollectionSource(file) &&
		(!basename.startsWith('_') || basename === '__proto__.ts')
	);
}

export function validateCollectionEntries(entries: string[]) {
	const slugs = new Set<string>();

	for (const entry of entries) {
		if (!isCollectionSource(entry)) continue;

		const slug = path.basename(entry, '.ts');
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
	const collectionsDir = path.join(root, 'collections');

	try {
		return await readdir(collectionsDir);
	} catch {
		return [];
	}
}

export async function discoverCollections(root: string): Promise<CollectionFile[]> {
	const collectionsDir = path.join(root, 'collections');
	const entries = await readCollectionEntries(root);

	validateCollectionEntries(entries);

	return entries
		.filter(isCollectionEntry)
		.sort()
		.map((entry) => ({
			file: path.join(collectionsDir, entry),
			slug: path.basename(entry, '.ts')
		}));
}
