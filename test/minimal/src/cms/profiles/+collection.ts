import { array, collection, group, text } from '@fieldstone/schema';

export default collection({
	fields: [
		text({ name: 'name', required: true }),
		group({
			name: 'address',
			fields: [text({ name: 'city', required: true }), text({ name: 'zip' })]
		}),
		array({
			name: 'links',
			fields: [text({ name: 'label', required: true }), text({ name: 'url' })]
		})
	]
});
