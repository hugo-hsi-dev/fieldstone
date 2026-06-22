import { expect, test, type Page } from '@playwright/test';

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

	await expect(page.getByRole('status')).toContainText('Post created');
	await expect(page.getByRole('heading', { name: 'POC post' })).toBeVisible();
	await expect(page.getByText('Created from admin')).toBeVisible();
	await expect(page.getByText('With another line')).toBeVisible();

	await page.getByRole('link', { name: 'Edit' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/posts\/[^/]+\/edit$/);
	const documentId = new URL(page.url()).pathname.split('/').at(-2);
	if (!documentId) throw new Error('Expected document id in edit URL');
	await expect(page.getByLabel('Title')).toHaveValue('POC post');
	await expect(page.locator('form input[name="id"]')).toHaveValue(documentId);
	await page.getByLabel('Title').fill('Edited POC post');
	await page.getByLabel('Description').fill('Updated body');
	await page.getByRole('button', { name: 'Save post' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/posts\/[^/]+$/);
	await expect(page.getByRole('status')).toContainText('Post saved');
	await expect(page.getByRole('heading', { name: 'Edited POC post' })).toBeVisible();
	await expect(page.getByText('Updated body')).toBeVisible();

	// Deleting now goes through a confirmation dialog.
	await page.getByRole('button', { name: 'Delete post' }).click();
	await expect(page.locator('form.fs-admin__delete-form input[name="id"]')).toHaveValue(documentId);
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
	await expect(page.getByRole('status')).toContainText('Post deleted');
	await expect(page.getByRole('link', { name: 'Edited POC post' })).not.toBeVisible();
});

test('validates create forms through remote form issues', async ({ page }) => {
	await page.goto('/admin/collections/posts/new');

	await expect(page.getByLabel('Title')).not.toHaveAttribute('required', '');
	await expect(page.getByLabel('Description')).not.toHaveAttribute('required', '');
	await page.getByRole('button', { name: 'Create post' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/posts\/new$/);
	await expect(page.getByText('title is required')).toBeVisible();
	await expect(page.getByText('description is required')).toBeVisible();
});

test('validates edit forms through remote form issues', async ({ page }) => {
	await createPost(page, 'Remote validation edit');

	await page.getByRole('link', { name: 'Edit' }).click();
	await page.getByLabel('Title').fill('');
	await page.getByRole('button', { name: 'Save post' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/posts\/[^/]+\/edit$/);
	await expect(page.getByText('title is required')).toBeVisible();
});

test('stores blank optional text fields as empty in the UI', async ({ page }) => {
	await page.goto('/admin/collections/pages/new');

	await page.getByLabel('Headline').fill('Optional summary page');
	await page.getByLabel('Path').fill('/optional-summary');
	await page.getByRole('button', { name: 'Create page' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/pages\/[^/]+$/);
	await expect(page.getByText('Empty')).toBeVisible();
});

test('creates a document for a zero-field collection', async ({ page }) => {
	await page.goto('/admin/collections/empty/new');

	await page.getByRole('button', { name: 'Create empty' }).click();

	await expect(page).toHaveURL(/\/admin\/collections\/empty\/[^/]+$/);
	await expect(page.getByRole('link', { name: 'Back to list' })).toBeVisible();
});

test('edits a global through route-driven admin', async ({ page }) => {
	await page.goto('/admin/globals/site-settings');

	await expect(page.getByRole('heading', { level: 1, name: 'Site Settings' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Site Settings' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await page.getByLabel('SiteTitle').fill('Fieldstone CMS');
	await page.getByLabel('Tagline').fill('Single use content');
	await page.getByRole('button', { name: 'Save site settings' }).click();

	await expect(page).toHaveURL(/\/admin\/globals\/site-settings$/);
	await expect(page.getByLabel('SiteTitle')).toHaveValue('Fieldstone CMS');
	await expect(page.getByLabel('Tagline')).toHaveValue('Single use content');
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
