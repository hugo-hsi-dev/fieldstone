import { collection, richText, text } from '@fieldstone/schema';

export default collection({
	fields: [
		text({ name: 'title', required: true }),
		text({ name: 'slug' }),
		richText({ name: 'body' })
	],
	drafts: true,
	hooks: {
		beforeChange: [
			({ data }) => {
				if (!data.slug && typeof data.title === 'string') {
					return {
						...data,
						slug: data.title
							.toLowerCase()
							.replace(/[^a-z0-9]+/g, '-')
							.replace(/^-|-$/g, '')
					};
				}
			}
		]
	}
});
