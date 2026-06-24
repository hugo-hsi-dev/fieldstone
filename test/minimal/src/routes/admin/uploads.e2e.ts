import { expect, test } from '@playwright/test';

// A solid 8x8 PNG that sharp can fully decode (so a variant is generated).
const PNG_8x8 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWMIqDiBFTEMLQkA9QJkAZ/vRFcAAAAASUVORK5CYII=',
	'base64'
);

test('uploads media and references it from a post', async ({ page }) => {
	// Upload an image on the media collection's own page (the upload form).
	await page.goto('/admin/collections/media/new');
	await page.locator('input[type=file]').setInputFiles({
		name: 'pixel.png',
		mimeType: 'image/png',
		buffer: PNG_8x8
	});
	await page.getByRole('button', { name: /upload/i }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/media\/[0-9a-f-]{8,}$/);
	const mediaId = new URL(page.url()).pathname.split('/').at(-1) ?? '';
	expect(mediaId).not.toBe('');

	// The media list shows a thumbnail whose URL actually serves the bytes.
	await page.goto('/admin/collections/media');
	const thumb = page.locator('.fs-admin__list-thumb').first();
	await expect(thumb).toBeVisible();
	const src = (await thumb.getAttribute('src')) ?? '';
	expect(src).toMatch(/^\/media\//);
	// The list uses the sharp-generated `thumbnail` variant (adminThumbnail).
	expect(src).toContain('-thumbnail');
	const served = await page.request.get(src);
	expect(served.status()).toBe(200);
	expect(served.headers()['content-type']).toContain('image/png');
	expect(served.headers()['x-content-type-options']).toBe('nosniff');

	// A post references the uploaded media via the upload picker.
	await page.goto('/admin/collections/posts/new');
	await page.getByLabel('Title').fill('Post with cover');
	await page.getByLabel('Description').fill('Has an image');
	await page.getByLabel('Cover', { exact: true }).selectOption(mediaId);
	await page.getByRole('button', { name: 'Create post' }).click();
	await expect(page).toHaveURL(/\/admin\/collections\/posts\/[0-9a-f-]{8,}$/);

	// The edit form (fresh load) reflects the stored upload reference.
	await page.goto(`${page.url()}/edit`);
	await expect(page.getByLabel('Cover', { exact: true })).toHaveValue(mediaId);
});
