import { collection, text } from '@fieldstone/plugin';

export default collection({
	fields: [
		text({ name: 'title', required: true }),
		text({ name: 'description', multiline: true, required: true })
	]
});
