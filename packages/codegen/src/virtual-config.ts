import path from 'node:path';

import type { FieldstoneConfigInput } from '@fieldstone/schema';

import { discoverCollections, normalizePath } from './collections.ts';

export async function loadVirtualConfig(root: string, options: FieldstoneConfigInput) {
	const collections = await discoverCollections(root);
	const imports = collections
		.map(({ file, slug }, index) => {
			const importPath = `/${normalizePath(path.relative(root, file))}`;
			return `import collection${index} from ${JSON.stringify(importPath)};\nconst runtimeCollection${index} = { ...collection${index}, slug: ${JSON.stringify(slug)} };`;
		})
		.join('\n');
	const collectionEntries = collections
		.map(({ slug }, index) => `${JSON.stringify(slug)}: runtimeCollection${index}`)
		.join(',\n');

	return `${imports}\n\nconst databaseURL = process.env.DATABASE_URL ?? ${JSON.stringify(options.db.url)};\n\nexport default {\n  db: {\n    dialect: ${JSON.stringify(options.db.dialect)},\n    url: databaseURL\n  },\n  collections: {\n${collectionEntries}\n  }\n};\n`;
}
