export const adminRouteId = "/admin/[...segments]";

export function adminRouteSegments(path: string) {
  if (path === "/admin") return "";
  return path.startsWith("/admin/") ? path.slice("/admin/".length) : path;
}

export function adminIndexPath() {
  return "/admin";
}

export function adminCollectionPath(collection: string) {
  return `/admin/collections/${encodeURIComponent(collection)}`;
}

export function adminNewDocumentPath(collection: string) {
  return `${adminCollectionPath(collection)}/new`;
}

export function adminDocumentPath(collection: string, id: string) {
  return `${adminCollectionPath(collection)}/${encodeURIComponent(id)}`;
}

export function adminEditDocumentPath(collection: string, id: string) {
  return `${adminDocumentPath(collection, id)}/edit`;
}

export function adminGlobalPath(global: string) {
  return `/admin/globals/${encodeURIComponent(global)}`;
}

export function resolveAdminPath(
  resolvePath: (routeId: string, params: { segments: string }) => string,
  path: string,
) {
  return resolvePath(adminRouteId, { segments: adminRouteSegments(path) });
}
