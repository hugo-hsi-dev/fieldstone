export type TextFieldConfig = {
	name: string;
	type: 'text';
	label?: string;
	required?: boolean;
};

export type CollectionConfig = {
	slug: string;
	labels?: {
		singular?: string;
		plural?: string;
	};
	fields: TextFieldConfig[];
};

const collections = [
	{
		slug: 'posts',
		labels: { singular: 'Post', plural: 'Posts' },
		fields: [
			{ name: 'title', type: 'text', label: 'Title', required: true },
			{ name: 'description', type: 'text', label: 'Description', required: true }
		]
	},
	{
		slug: 'pages',
		labels: { singular: 'Page', plural: 'Pages' },
		fields: [
			{ name: 'headline', type: 'text', label: 'Headline', required: true },
			{ name: 'path', type: 'text', label: 'Path', required: true },
			{ name: 'summary', type: 'text', label: 'Summary' }
		]
	}
] as const satisfies readonly CollectionConfig[];

export const cmsConfig: { collections: readonly CollectionConfig[] } = {
	collections
};

export type CollectionName = (typeof collections)[number]['slug'];

export function getCollectionConfig(slug: string): CollectionConfig | null {
	return cmsConfig.collections.find((collection) => collection.slug === slug) ?? null;
}

export function getCollectionLabel(collection: CollectionConfig, count: 'singular' | 'plural') {
	return collection.labels?.[count] ?? collection.slug;
}

export function getFieldLabel(field: TextFieldConfig) {
	return field.label ?? field.name;
}
