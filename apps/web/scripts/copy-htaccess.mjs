import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(currentDir, "..");
const sourcePath = resolve(webRoot, "public", ".htaccess");
const destinationPath = resolve(webRoot, "dist", ".htaccess");

if (existsSync(sourcePath)) {
  mkdirSync(resolve(webRoot, "dist"), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
  console.log("Copied .htaccess into dist.");
}
