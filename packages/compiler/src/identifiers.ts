export function toIdentifier(value: string) {
  const identifier = value
    .replace(/[^a-zA-Z0-9_$]+/g, "_")
    .replace(/^[^a-zA-Z_$]+/, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return identifier || "collection";
}

export function toUniqueIdentifier(value: string, used: Set<string>, prefix = "") {
  const base = toIdentifier(`${prefix}${value}`);
  let identifier = base;
  let index = 2;

  while (used.has(identifier)) {
    identifier = `${base}_${index}`;
    index += 1;
  }

  used.add(identifier);
  return identifier;
}
