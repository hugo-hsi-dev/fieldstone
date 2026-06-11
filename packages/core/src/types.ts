export type TextFieldDefinition = {
	multiline?: boolean;
	name: string;
	required?: boolean;
	type: 'text';
};

export type CollectionDefinition = {
	fields: TextFieldDefinition[];
};

export type CollectionRuntimeConfig = CollectionDefinition & {
	slug: string;
};

export type FieldstoneConfigInput = {
	db: {
		dialect: 'sqlite';
		url: string;
	};
};

export type FieldstoneConfig = FieldstoneConfigInput & {
	collections: Record<string, CollectionRuntimeConfig>;
};

export interface GeneratedCollections {}
