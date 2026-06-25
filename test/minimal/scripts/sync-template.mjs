import { copyFile, glob, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const templateRoot = path.resolve(appRoot, "../../packages/cli/templates");

for await (const entry of glob("**/*", { cwd: templateRoot, withFileTypes: true })) {
  if (!entry.isFile() || entry.name === ".env.example") continue;
  const relativePath = path.relative(templateRoot, path.join(entry.parentPath, entry.name));
  const target = path.join(appRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(templateRoot, relativePath), target);
}
