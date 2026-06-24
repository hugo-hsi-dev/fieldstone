import { global, text } from '@hugo-hsi-dev/schema';

export default global({
	fields: [text({ name: 'siteTitle', required: true }), text({ name: 'tagline' })]
});
