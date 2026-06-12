import { collection, text } from '@fieldstone/plugin';

export default collection({
	fields: [
		text({ name: 'headline', required: true }),
		text({ name: 'path', required: true }),
		text({ name: 'summary' })
	]
});
