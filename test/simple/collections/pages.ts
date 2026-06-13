import { collection, text } from '@fieldstone/schema';

export default collection({
	fields: [
		text({ name: 'headline', required: true }),
		text({ name: 'path', required: true }),
		text({ name: 'summary' })
	]
});
