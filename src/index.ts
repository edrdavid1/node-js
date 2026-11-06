import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const HASH_PREFIX = "HASH: ";

function runTar(sourceDir: string, backupFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "tar",
      ["-czf", backupFilePath, "-C", sourceDir, "."],
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );
  });
}

async function getCurrentHash(sourceDir: string): Promise<string> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  return createHash("sha256").update(JSON.stringify(fileNames)).digest("hex");
}

async function getPreviousHash(logPath: string): Promise<string | undefined> {
  try {
    const log = await readFile(logPath, "utf8");
    const hashLines = log
      .split(/\r?\n/)
      .filter((line) => line.startsWith(HASH_PREFIX));
    const lastHashLine = hashLines.at(-1);
    return lastHashLine?.slice(HASH_PREFIX.length);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function writeLog(logPath: string, message: string): Promise<void> {
  await appendFile(logPath, `${new Date().toISOString()}: ${message}\n`, "utf8");
}

async function main(): Promise<void> {
  const [sourceArg, backupArg] = process.argv.slice(2);
  if (!sourceArg || !backupArg) {
    console.error("Usage: ts-node ./src/index.ts <sourceDir> <backupDir>");
    process.exitCode = 1;
    return;
  }

  const sourceDir = path.resolve(sourceArg);
  const backupDir = path.resolve(backupArg);
  const logPath = path.join(backupDir, "backup_log.txt");

  try {
    await mkdir(backupDir, { recursive: true });
    const currentHash = await getCurrentHash(sourceDir);
    const previousHash = await getPreviousHash(logPath);

    if (currentHash === previousHash) {
      await writeLog(logPath, "SKIPPED: No changes detected");
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFilePath = path.join(
      backupDir,
      `backup-${timestamp}.tar.gz`,
    );

    await runTar(sourceDir, backupFilePath);
    await appendFile(
      logPath,
      `${new Date().toISOString()}: SUCCESS: Backup created\n${HASH_PREFIX}${currentHash}\n`,
      "utf8",
    );
  } catch (error) {
    try {
      await writeLog(logPath, "FAILED: tar command failed");
    } catch (logError) {
      console.error("Could not write to backup_log.txt:", logError);
    }
    console.error("Backup failed:", error);
    process.exitCode = 1;
  }
}

void main();
