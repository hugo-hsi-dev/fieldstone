import { collection, text, upload } from '@fieldstone/schema';

export default collection({
	fields: [
		text({ name: 'title', required: true }),
		text({ name: 'description', multiline: true, required: true }),
		upload({ name: 'cover', relationTo: 'media' })
	]
});
