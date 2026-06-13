import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const CMS_DIR = path.join('src', 'cms');
export const COLLECTION_FILENAME = '+collection.ts';

export type CollectionFile = {
	file: string;
	slug: string;
};

export type CollectionEntry = {
	entry: string;
	isBlank: boolean;
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

export function validateCollectionEntries(entries: CollectionEntry[]) {
	const slugs = new Set<string>();

	for (const { entry, isBlank } of entries) {
		if (isBlank) continue;

		const slug = entry;
		if (slug === '__proto__') throw new Error('Reserved collection slug: __proto__');
		if (entry.startsWith('_')) continue;

		const normalizedSlug = slug.toLowerCase();
		if (slugs.has(normalizedSlug)) throw new Error(`Duplicate collection slug: ${slug}`);
		slugs.add(normalizedSlug);
	}
}

export async function readCollectionEntries(root: string) {
	const cmsDir = path.join(root, CMS_DIR);

	try {
		return await readdir(cmsDir, { withFileTypes: true });
	} catch {
		return [];
	}
}

async function readCollectionEntry(cmsDir: string, entry: string): Promise<CollectionEntry | null> {
	const file = path.join(cmsDir, entry, COLLECTION_FILENAME);

	try {
		const source = await readFile(file, 'utf-8');
		return {
			entry,
			isBlank: !source.trim()
		};
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return null;
		}
		throw error;
	}
}

export async function discoverCollections(root: string): Promise<CollectionFile[]> {
	const cmsDir = path.join(root, CMS_DIR);
	const entries = await readCollectionEntries(root);
	const collectionEntries = (
		await Promise.all(
			entries
				.filter((entry) => entry.isDirectory())
				.map((entry) => readCollectionEntry(cmsDir, entry.name))
		)
	).filter((entry): entry is CollectionEntry => entry !== null);

	collectionEntries.sort((a, b) => a.entry.localeCompare(b.entry));
	validateCollectionEntries(collectionEntries);

	return collectionEntries
		.filter(({ entry, isBlank }) => !isBlank && isCollectionEntry(entry))
		.map(({ entry }) => ({
			file: path.join(cmsDir, entry, COLLECTION_FILENAME),
			slug: entry
		}));
}
