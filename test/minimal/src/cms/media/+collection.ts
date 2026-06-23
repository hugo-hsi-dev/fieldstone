import { collection, text } from '@fieldstone/schema';

export default collection({
	fields: [text({ name: 'alt' })],
	upload: { mimeTypes: ['image/*'], maxFileSize: 5_000_000 },
	access: {
		// Uploads write files to disk, so require an authenticated user. The serve
		// route (/media) stays public; access-controlled serving is a later slice.
		create: ({ user }) => Boolean(user)
	}
});
