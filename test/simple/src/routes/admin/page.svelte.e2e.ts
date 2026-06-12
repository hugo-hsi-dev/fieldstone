import { expect, test, type Page } from '@playwright/test';
import Database from 'better-sqlite3';

test.describe.configure({ mode: 'serial' });

async function createPost(page: Page, title: string) {
	await page.goto('/admin/collections/posts/new');
	await page.getByLabel('Title').fill(title);
	await page.getByLabel('Description').fill('Created from admin\nWith another line');
	await page.getByRole('button', { name: 'Create post' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/posts\/[^/]+$/);
}

test('creates, edits, and deletes a post through route-driven admin', async ({ page }) => {
	await createPost(page, 'POC post');

	await expect(page.getByRole('heading', { name: 'POC post' })).toBeVisible();
	await expect(page.getByText('Created from admin')).toBeVisible();
	await expect(page.getByText('With another line')).toBeVisible();

	await page.getByRole('link', { name: 'Edit' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/posts\/[^/]+\/edit$/);
	await expect(page.getByLabel('Title')).toHaveValue('POC post');
	await page.getByLabel('Title').fill('Edited POC post');
	await page.getByLabel('Description').fill('Updated body');
	await page.getByRole('button', { name: 'Save post' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/posts\/[^/]+$/);
	await expect(page.getByRole('heading', { name: 'Edited POC post' })).toBeVisible();
	await expect(page.getByText('Updated body')).toBeVisible();

	await page.getByRole('button', { name: 'Delete post' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
	await expect(page.getByRole('link', { name: 'Edited POC post' })).not.toBeVisible();
});

test('stores blank optional text fields as null', async ({ page }) => {
	await page.goto('/admin/collections/pages/new');

	await page.getByLabel('Headline').fill('Optional summary page');
	await page.getByLabel('Path').fill('/optional-summary');
	await page.getByRole('button', { name: 'Create page' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/pages\/[^/]+$/);
	await expect(page.getByText('Empty')).toBeVisible();

	const db = new Database('e2e.db');
	const row = db.prepare("select summary from pages where headline = 'Optional summary page'").get() as {
		summary: string | null;
	};
	db.close();

	expect(row.summary).toBeNull();
});

test('creates a document for a zero-field collection', async ({ page }) => {
	await page.goto('/admin/collections/empty/new');

	await page.getByRole('button', { name: 'Create empty' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/empty\/[^/]+$/);
	await expect(page.getByRole('link', { name: 'Back to list' })).toBeVisible();
});

test('keeps navigation state current across collection routes', async ({ page }) => {
	await page.goto('/admin/collections/pages');

	await page.getByRole('link', { name: 'Posts' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Posts' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'New post' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Posts' })).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('link', { name: 'Posts' })).toHaveClass(/fs-admin__nav-link--active/);
	await expect(page.getByRole('link', { name: 'Pages' })).not.toHaveAttribute(
		'aria-current',
		'page'
	);

	await page.getByRole('link', { name: 'Pages' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/pages$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Pages' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'New page' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Pages' })).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('link', { name: 'Pages' })).toHaveClass(/fs-admin__nav-link--active/);
	await expect(page.getByRole('link', { name: 'Posts' })).not.toHaveAttribute(
		'aria-current',
		'page'
	);
});

test('loads fresh document data on edit route', async ({ page }) => {
	await createPost(page, 'Stale source');
	await page.getByRole('link', { name: 'Back to list' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
	await expect(page.getByRole('link', { name: 'Stale source' })).toBeVisible();

	const db = new Database('e2e.db');
	db.prepare("update posts set title = 'Fresh source', description = 'Fresh body' where title = 'Stale source'").run();
	db.close();

	await page
		.getByRole('article')
		.filter({ has: page.getByRole('link', { name: 'Stale source' }) })
		.getByRole('link', { name: 'Edit' })
		.click();

	await expect(page).toHaveURL(/\/admin\/collections\/posts\/[^/]+\/edit$/);
	await expect(page.getByLabel('Title')).toHaveValue('Fresh source');
	await expect(page.getByLabel('Description')).toHaveValue('Fresh body');
});

test('keeps navigation state current when document loading fails', async ({ page }) => {
	const db = new Database('e2e.db');
	db.exec('drop table pages');
	db.close();

	await page.goto('/admin/collections/posts');

	await page.getByRole('link', { name: 'Pages' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/pages$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Pages' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Pages' })).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('link', { name: 'Pages' })).toHaveClass(/fs-admin__nav-link--active/);
	await expect(page.getByRole('link', { name: 'Posts' })).not.toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByText('Could not load admin data')).toBeVisible();
});
