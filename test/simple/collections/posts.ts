import { collection, text } from '@fieldstone/schema';

export default collection({
	fields: [
		text({ name: 'title', required: true }),
		text({ name: 'description', multiline: true, required: true })
	]
});
