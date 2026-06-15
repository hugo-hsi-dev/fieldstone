import { global, text } from '@fieldstone/schema';

export default global({
	fields: [text({ name: 'siteTitle', required: true }), text({ name: 'tagline' })]
});
