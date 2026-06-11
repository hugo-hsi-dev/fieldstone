import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const packageRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const cliPath = path.join(packageRoot, 'bin', 'fieldstone.mjs');

function runFieldstoneGenerate(cwd: string) {
	return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
		const child = spawn(process.execPath, [cliPath, 'generate'], {
			cwd,
			env: {
				...process.env,
				DATABASE_URL: ':memory:'
			},
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolve({ stderr, stdout });
				return;
			}

			reject(new Error(`fieldstone generate exited ${code}\n${stdout}\n${stderr}`));
		});
	});
}

describe('fieldstone cli', () => {
	it('loads collections with the app Vite config', async () => {
		const tmpRoot = path.join(packageRoot, '.tmp');
		await mkdir(tmpRoot, { recursive: true });
		const root = await mkdtemp(path.join(tmpRoot, 'fieldstone-cli-'));

		try {
			await mkdir(path.join(root, 'collections'), { recursive: true });
			await mkdir(path.join(root, 'src'), { recursive: true });
			await writeFile(
				path.join(root, 'vite.config.ts'),
				`import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
\tresolve: {
\t\talias: {
\t\t\t$fields: path.resolve('src/fields.ts')
\t\t}
\t}
});
`
			);
			await writeFile(
				path.join(root, 'src', 'fields.ts'),
				`import { text } from '@fieldstone/plugin';

export const title = text({ name: 'title', required: true });
`
			);
			await writeFile(
				path.join(root, 'collections', 'posts.ts'),
				`import { collection } from '@fieldstone/plugin';
import { title } from '$fields';

export default collection({
\tfields: [title]
});
`
			);

			await runFieldstoneGenerate(root);
			const schema = await readFile(path.join(root, '.fieldstone', 'schema.ts'), 'utf-8');

			expect(schema).toContain('export const collection_posts = sqliteTable("posts"');
			expect(schema).toContain('title: text("title").notNull()');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('rejects prototype-mutating collection slugs', async () => {
		const tmpRoot = path.join(packageRoot, '.tmp');
		await mkdir(tmpRoot, { recursive: true });
		const root = await mkdtemp(path.join(tmpRoot, 'fieldstone-cli-'));

		try {
			await mkdir(path.join(root, 'collections'), { recursive: true });
			await writeFile(
				path.join(root, 'collections', '__proto__.ts'),
				`import { collection, text } from '@fieldstone/plugin';

export default collection({
\tfields: [text({ name: 'title', required: true })]
});
`
			);

			await expect(runFieldstoneGenerate(root)).rejects.toThrow(
				'Reserved collection slug: __proto__'
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
