export type { FieldstoneAdminRemotes } from '@hugo-hsi-dev/admin-runtime/sveltekit';

export type RemoteFormField = {
	as(type: string, value?: string | boolean): Record<string, unknown>;
	issues(): { message: string }[] | undefined;
};
export type RemoteForm = {
	fields: unknown;
	pending?: number;
} & Record<string, unknown>;
export type RemoteFormFields<TName extends string = never> = {
	allIssues(): { message: string }[] | undefined;
	data: Record<string, RemoteFormField>;
} & Record<TName, RemoteFormField>;
export type RemoteUploadFields = {
	allIssues(): { message: string }[] | undefined;
	collection: RemoteFormField;
	file: RemoteFormField;
};
