import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PostgresSchoolRepository } from "./school-postgres";
import { R2Storage, EncryptedPrivateStorage } from "./private-storage";
import { checkSchoolState } from "./school-store";

for (const file of [".env.local", ".env"])
  if (existsSync(resolve(file))) process.loadEnvFile(resolve(file));
const required = [
  "COTEACHER_TUTOR_STORAGE_KEY",
  "COTEACHER_SCHOOL_DATABASE_URL",
  "COTEACHER_SUPABASE_URL",
  "COTEACHER_SUPABASE_PUBLISHABLE_KEY",
  "COTEACHER_R2_ENDPOINT",
  "COTEACHER_R2_BUCKET",
  "COTEACHER_R2_ACCESS_KEY_ID",
  "COTEACHER_R2_SECRET_ACCESS_KEY",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(
    JSON.stringify(
      {
        status: "UNVERIFIED",
        reason: "Provider configuration missing",
        missing,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else {
  const result: Record<string, string> = {};
  const repository = new PostgresSchoolRepository(
    process.env.COTEACHER_SCHOOL_DATABASE_URL!,
  );
  try {
    await repository.migrate();
    await repository.transaction((s) => {
      checkSchoolState(s);
    });
    result.postgres = "PASS: migration and transactional contract read";
  } catch {
    result.postgres = "FAIL: database connection or migration";
  } finally {
    await repository.close();
  }
  const storage = new EncryptedPrivateStorage(
    new R2Storage(
      process.env.COTEACHER_R2_ENDPOINT!,
      process.env.COTEACHER_R2_BUCKET!,
      process.env.COTEACHER_R2_ACCESS_KEY_ID!,
      process.env.COTEACHER_R2_SECRET_ACCESS_KEY!,
    ),
    process.env.COTEACHER_TUTOR_STORAGE_KEY!,
  );
  const key = `verification/${randomUUID()}.bin`,
    bytes = Buffer.from("Coteacher private storage verification");
  try {
    await storage.put(key, bytes, "application/octet-stream");
    if (!Buffer.from(await storage.get(key)).equals(bytes)) throw new Error();
    await storage.delete(key);
    result.r2 = "PASS: encrypted private object write/read/delete";
  } catch {
    result.r2 = "FAIL: private storage round trip";
  }
  if (
    process.env.COTEACHER_VERIFY_EMAIL &&
    process.env.COTEACHER_VERIFY_PASSWORD
  ) {
    const client = createClient(
      process.env.COTEACHER_SUPABASE_URL!,
      process.env.COTEACHER_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    try {
      const login = await client.auth.signInWithPassword({
        email: process.env.COTEACHER_VERIFY_EMAIL,
        password: process.env.COTEACHER_VERIFY_PASSWORD,
      });
      if (login.error || !login.data.session) throw new Error();
      const verified = await client.auth.getUser();
      if (verified.error || !verified.data.user?.email_confirmed_at)
        throw new Error();
      result.identity = "PASS: real provider sign-in and verified email";
      if (process.env.COTEACHER_VERIFY_TOTP) {
        const factors = await client.auth.mfa.listFactors();
        const factor = factors.data?.totp[0];
        if (!factor) throw new Error();
        const elevated = await client.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code: process.env.COTEACHER_VERIFY_TOTP,
        });
        if (elevated.error) throw new Error();
        result.mfa = "PASS: real authenticator challenge";
      } else result.mfa = "UNVERIFIED: supply a current test-account TOTP";
      await client.auth.signOut({ scope: "local" });
    } catch {
      result.identity = "FAIL: provider verification or MFA challenge";
    }
  } else
    result.identity =
      "UNVERIFIED: supply an existing verified fictional test-account email/password; this script never sends signup email";
  console.log(JSON.stringify(result, null, 2));
  if (Object.values(result).some((x) => !x.startsWith("PASS")))
    process.exitCode = 1;
}
