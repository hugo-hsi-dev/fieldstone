import path from "node:path";
import { svelteKitConfig } from "../../eslint.shared.js";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

export default svelteKitConfig({
  gitignorePath,
  tsconfigRootDir: import.meta.dirname,
});
