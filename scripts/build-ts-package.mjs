import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const bin = process.platform === "win32" ? "tsc.cmd" : "tsc";
const buildConfig = ".tsconfig.build.tmp.json";

let status;
try {
  rmSync("dist", { force: true, recursive: true });
  writeFileSync(
    buildConfig,
    `${JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          declaration: true,
          noEmit: false,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );

  const tsc = spawnSync(bin, ["-p", buildConfig], { stdio: "inherit" });
  if (tsc.status !== 0) {
    status = tsc.status ?? 1;
  } else {
    status = 0;
  }
} finally {
  rmSync(buildConfig, { force: true });
}

process.exit(status ?? 1);
