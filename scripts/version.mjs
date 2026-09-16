import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

let commitTime;
try {
  commitTime = execSync("git log -1 --format=%cI").toString().trim();
} catch {
  commitTime = new Date().toISOString();
}

mkdirSync("public", { recursive: true });

writeFileSync(
  "public/version.json",
  JSON.stringify({ version: pkg.version, deployTime: commitTime })
);

console.log(`version.json → v${pkg.version} @ ${commitTime}`);
