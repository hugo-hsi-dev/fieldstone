// The names of the admin remote functions that `createFieldstoneAdminRemotes`
// (in @hugo-hsi-dev/remotes) returns.
//
// This list is the single source of truth for the generated `dashboard.remote.ts`
// barrel. It lives in @hugo-hsi-dev/schema — the shared leaf both ends can reach —
// because neither side can import the other: @hugo-hsi-dev/remotes is raw, $app-coupled
// source (so @hugo-hsi-dev/codegen can't import it at build time), and @hugo-hsi-dev/codegen
// is build-time tooling (so @hugo-hsi-dev/remotes shouldn't import it at runtime).
//
// @hugo-hsi-dev/remotes asserts at compile time that this list matches the actual return
// shape, so adding/removing a remote without updating this list fails the build.
export const FIELDSTONE_ADMIN_REMOTE_NAMES = [
  "listCollections",
  "getCollection",
  "listRelationOptions",
  "listGlobals",
  "getGlobalConfig",
  "getGlobal",
  "listDocuments",
  "getDocument",
  "createDocument",
  "uploadMedia",
  "updateDocument",
  "updateGlobal",
  "deleteDocument",
] as const;

export type FieldstoneAdminRemoteName =
  (typeof FIELDSTONE_ADMIN_REMOTE_NAMES)[number];
