import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { LocalSchoolRepository } from "./school-store";
import { PostgresSchoolRepository } from "./school-postgres";
import {
  EncryptedPrivateStorage,
  LocalPrivateStorage,
  R2Storage,
} from "./private-storage";
import { backupSchool, restoreSchool } from "./school-backup";
for (const file of [".env.local", ".env"])
  if (existsSync(resolve(file))) process.loadEnvFile(resolve(file));
if (
  process.env.COTEACHER_PUBLIC === "true" &&
  (!process.env.COTEACHER_SCHOOL_DATABASE_URL ||
    !process.env.COTEACHER_R2_ENDPOINT)
)
  throw new Error(
    "Public backups require configured PostgreSQL and private storage.",
  );
const restoring = process.argv[2] === "restore";
const path = process.argv[3];
if (
  !path ||
  !["backup", "restore"].includes(process.argv[2]) ||
  !process.env.COTEACHER_BACKUP_KEY
)
  throw new Error(
    "Usage: tsx delivery/school-backup-cli.ts backup|restore <folder>. Set COTEACHER_BACKUP_KEY first. Restore only into a separate empty target deployment.",
  );
const repository = process.env.COTEACHER_SCHOOL_DATABASE_URL
  ? new PostgresSchoolRepository(process.env.COTEACHER_SCHOOL_DATABASE_URL)
  : new LocalSchoolRepository(
      resolve(process.env.COTEACHER_DELIVERY_DIR ?? ".coteacher-delivery"),
    );
const rawStorage = process.env.COTEACHER_R2_ENDPOINT
  ? new R2Storage(
      process.env.COTEACHER_R2_ENDPOINT,
      process.env.COTEACHER_R2_BUCKET ?? "",
      process.env.COTEACHER_R2_ACCESS_KEY_ID ?? "",
      process.env.COTEACHER_R2_SECRET_ACCESS_KEY ?? "",
    )
  : new LocalPrivateStorage(
      resolve(
        process.env.COTEACHER_DELIVERY_DIR ?? ".coteacher-delivery",
        "private",
      ),
    );
const storage =
  process.env.COTEACHER_PUBLIC === "true" || !!process.env.COTEACHER_R2_ENDPOINT
    ? new EncryptedPrivateStorage(
        rawStorage,
        process.env.COTEACHER_TUTOR_STORAGE_KEY ?? "",
      )
    : rawStorage;
try {
  if (repository instanceof PostgresSchoolRepository)
    await repository.migrate();
  const result = restoring
    ? await restoreSchool(
        repository,
        storage,
        resolve(path),
        process.env.COTEACHER_BACKUP_KEY,
      )
    : await backupSchool(
        repository,
        storage,
        resolve(path),
        process.env.COTEACHER_BACKUP_KEY,
      );
  console.log(JSON.stringify(result));
} finally {
  if (repository instanceof PostgresSchoolRepository) await repository.close();
}
