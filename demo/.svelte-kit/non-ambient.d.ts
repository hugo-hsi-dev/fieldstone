
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/admin" | "/admin/[...segments]" | "/demo" | "/demo/better-auth" | "/demo/better-auth/login" | "/demo/playwright";
		RouteParams(): {
			"/admin/[...segments]": { segments: string }
		};
		LayoutParams(): {
			"/": { segments?: string | undefined };
			"/admin": { segments?: string | undefined };
			"/admin/[...segments]": { segments: string };
			"/demo": Record<string, never>;
			"/demo/better-auth": Record<string, never>;
			"/demo/better-auth/login": Record<string, never>;
			"/demo/playwright": Record<string, never>
		};
		Pathname(): "/" | `/admin/${string}` & {} | "/demo" | "/demo/better-auth" | "/demo/better-auth/login" | "/demo/playwright";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/robots.txt" | string & {};
	}
}