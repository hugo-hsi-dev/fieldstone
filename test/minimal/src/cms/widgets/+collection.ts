import { collection, text } from '@hugo-hsi-dev/schema';

export default collection({
	fields: [text({ name: 'name', required: true })]
});
