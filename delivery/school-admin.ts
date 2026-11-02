import { LocalSchoolRepository, SchoolService } from "./school-store";
import { PostgresSchoolRepository } from "./school-postgres";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"])
  if (existsSync(resolve(file))) process.loadEnvFile(resolve(file));

// Local operator provisioning is explicit; never create a public default admin.
const email = process.env.COTEACHER_OPERATOR_EMAIL;
const password = process.env.COTEACHER_OPERATOR_PASSWORD;
if (!email || !password || process.env.COTEACHER_PUBLIC === "true")
  throw new Error("Set fictional operator email/password in local mode.");
const repository = process.env.COTEACHER_SCHOOL_DATABASE_URL
  ? new PostgresSchoolRepository(process.env.COTEACHER_SCHOOL_DATABASE_URL)
  : new LocalSchoolRepository(
      resolve(process.env.COTEACHER_DELIVERY_DIR ?? ".coteacher-delivery"),
    );
try {
  if (repository instanceof PostgresSchoolRepository)
    await repository.migrate();
  const service = new SchoolService(repository);
  const account = await service.register({
    email,
    password,
    name: "Simulated platform reviewer",
    role: "owner",
    simulated: true,
  });
  await repository.transaction((s) => {
    const a = s.accounts.find((x) => x.id === account.id)!;
    a.role = "operator";
    a.verified = true;
  });
  console.log("Fictional operator created. Sign in through the school portal.");
} finally {
  if (repository instanceof PostgresSchoolRepository) await repository.close();
}
