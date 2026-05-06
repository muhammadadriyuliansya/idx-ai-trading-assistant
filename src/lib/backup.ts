"use client";

import { createLogger } from "./logger";

const logger = createLogger("backup");

const IDXAI_STORAGE_PREFIX = "idxai.";

interface BackupData {
  version: 1;
  exportedAt: string;
  entries: Record<string, string>;
}

/**
 * Export all idxai.* localStorage keys to a JSON string.
 */
export function exportBackup(): string {
  const entries: Record<string, string> = {};

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(IDXAI_STORAGE_PREFIX)) {
      const value = window.localStorage.getItem(key);
      if (value !== null) {
        entries[key] = value;
      }
    }
  }

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  };

  logger.info(`Exported ${Object.keys(entries).length} storage keys`);
  return JSON.stringify(backup, null, 2);
}

/**
 * Import a backup JSON string into localStorage.
 * Returns the number of keys imported.
 */
export function importBackup(json: string): number {
  let backup: BackupData;
  try {
    backup = JSON.parse(json) as BackupData;
  } catch {
    throw new Error("Invalid backup file format");
  }

  if (!backup.version || !backup.entries || typeof backup.entries !== "object") {
    throw new Error("Invalid backup file structure");
  }

  let count = 0;
  for (const [key, value] of Object.entries(backup.entries)) {
    if (key.startsWith(IDXAI_STORAGE_PREFIX)) {
      try {
        window.localStorage.setItem(key, value);
        count++;
      } catch {
        logger.warn(`Failed to import key: ${key}`);
      }
    }
  }

  logger.info(`Imported ${count} storage keys`);
  return count;
}

/**
 * Trigger a file download of the backup JSON.
 */
export function downloadBackup(): void {
  const json = exportBackup();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `idxai-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Read a File object and return its text content.
 */
export function readBackupFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read backup file"));
    reader.readAsText(file);
  });
}
