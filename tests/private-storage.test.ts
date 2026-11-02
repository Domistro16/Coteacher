import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  EncryptedPrivateStorage,
  LocalPrivateStorage,
  R2Storage,
} from "../delivery/private-storage";
let folder: string;
afterEach(async () => {
  if (folder) await rm(folder, { recursive: true, force: true });
});
describe("private school object encryption", () => {
  it("signs private upload tickets for their exact size, media type and short expiry without a network request", async () => {
    const storage = new R2Storage(
      "https://fictional.r2.cloudflarestorage.com",
      "fictional-school",
      "fictional-access-key",
      "fictional-secret-key",
    );
    const url = new URL(await storage.uploadUrl("uploads/fictional.ogg", 1234));
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-length",
    );
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-type",
    );
    expect(url.pathname).toContain("uploads/fictional.ogg");
  });
  it("encrypts received records and audio, authenticates object identity and rejects the wrong key", async () => {
    folder = await mkdtemp(join(tmpdir(), "coteacher-private-"));
    const underlying = new LocalPrivateStorage(folder);
    const storage = new EncryptedPrivateStorage(
      underlying,
      "fictional-server-storage-secret-12345",
    );
    const bytes = Buffer.from("Fictional private question");
    await storage.put("school/record.json", bytes, "application/json");
    const raw = await underlying.get("school/record.json");
    expect(Buffer.from(raw).includes(bytes)).toBe(false);
    expect(Buffer.from(await storage.get("school/record.json"))).toEqual(bytes);
    await underlying.put("school/copied.json", raw);
    await expect(storage.get("school/copied.json")).rejects.toThrow();
    await expect(
      new EncryptedPrivateStorage(
        underlying,
        "a-different-fictional-server-secret",
      ).get("school/record.json"),
    ).rejects.toThrow();
    const changed = Buffer.from(raw);
    changed[changed.length - 1] ^= 1;
    await underlying.put("school/record.json", changed);
    await expect(storage.get("school/record.json")).rejects.toThrow();
  });
});
