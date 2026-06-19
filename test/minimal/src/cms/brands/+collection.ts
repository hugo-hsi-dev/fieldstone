import { collection, text } from '@fieldstone/schema';

export default collection({
	fields: [text({ name: 'name', required: true })]
});
