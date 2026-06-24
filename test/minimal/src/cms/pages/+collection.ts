import { collection, text } from '@hugo-hsi-dev/schema';

export default collection({
	fields: [
		text({ name: 'headline', required: true }),
		text({ name: 'path', required: true }),
		text({ name: 'summary' })
	]
});
