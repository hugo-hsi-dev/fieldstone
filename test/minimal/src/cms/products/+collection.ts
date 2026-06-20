import {
	boolean,
	collection,
	date,
	email,
	number,
	relationship,
	select,
	text
} from '@fieldstone/schema';

export default collection({
	fields: [
		text({ name: 'name', required: true }),
		number({ name: 'price', required: true, min: 0 }),
		select({
			name: 'status',
			options: ['draft', 'active', 'archived'],
			defaultValue: 'draft'
		}),
		email({ name: 'contact', admin: { description: 'Support contact email' } }),
		date({ name: 'launchDate' }),
		boolean({ name: 'featured' }),
		relationship({ name: 'brand', relationTo: 'brands' }),
		relationship({ name: 'relatedBrands', relationTo: 'brands', hasMany: true }),
		text({ name: 'sku', unique: true })
	]
});
