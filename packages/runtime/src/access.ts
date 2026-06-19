import type {
  AccessOperation,
  AccessUser,
  FieldstoneConfig,
} from "@fieldstone/schema";

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function isForbiddenError(error: unknown): error is ForbiddenError {
  return (
    error instanceof ForbiddenError ||
    (typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: unknown }).status === 403)
  );
}

export async function assertCollectionAccess(
  config: FieldstoneConfig,
  collection: string,
  operation: AccessOperation,
  args: { user: AccessUser; id?: string; data?: Record<string, unknown> },
): Promise<void> {
  // Look up by slug, not config key — collections may be registered under a key
  // that differs from their slug, and runtime/REST calls pass the slug.
  const collectionConfig = Object.values(config.collections).find(
    (entry) => entry.slug === collection,
  );
  const access = collectionConfig?.access?.[operation];
  if (!access) return;
  const allowed = await access({
    collection,
    operation,
    user: args.user ?? null,
    id: args.id,
    data: args.data,
  });
  if (!allowed) throw new ForbiddenError();
}
