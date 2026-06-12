export function getAdminSegments(pathname: string) {
	const parts = pathname.split('/').filter(Boolean);
	const adminIndex = parts.findIndex((part) => part === 'admin');
	if (adminIndex === -1) return [];

	return parts.slice(adminIndex + 1).map((part) => decodeURIComponent(part));
}
