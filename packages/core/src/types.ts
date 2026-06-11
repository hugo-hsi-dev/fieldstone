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

type GeneratedCollectionSlug = keyof GeneratedCollections & string;

export type CollectionSlug = [GeneratedCollectionSlug] extends [never]
	? string
	: GeneratedCollectionSlug;

export type SystemFieldName = 'id' | 'createdAt' | 'updatedAt';

export type CollectionDocument<TCollection extends string> =
	TCollection extends keyof GeneratedCollections
		? GeneratedCollections[TCollection]
		: {
				id: string;
				createdAt: Date;
				updatedAt: Date;
			} & Record<string, unknown>;

export type CollectionData<TCollection extends string> =
	TCollection extends keyof GeneratedCollections
		? {
				[K in Exclude<keyof GeneratedCollections[TCollection], SystemFieldName> &
					string]: GeneratedCollections[TCollection][K] extends string
					? string
					: GeneratedCollections[TCollection][K];
			}
		: Record<string, string>;
