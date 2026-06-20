import { collection, text } from '@fieldstone/schema';

export default collection({
	fields: [text({ name: 'title', required: true })],
	access: {
		// Only authenticated users may read or create secrets.
		read: ({ user }) => Boolean(user),
		create: ({ user }) => Boolean(user)
	}
});
