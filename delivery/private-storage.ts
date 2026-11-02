import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";

export interface PrivateStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string, maxBytes?: number): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  uploadUrl?(key: string, byteLength: number): Promise<string>;
}
export class R2Storage implements PrivateStorage {
  private client: S3Client;
  constructor(
    endpoint: string,
    private bucket: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    if (
      !endpoint.startsWith("https://") ||
      !bucket ||
      !accessKeyId ||
      !secretAccessKey
    )
      throw new Error("Configure private R2 storage.");
    this.client = new S3Client({
      endpoint,
      region: "auto",
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  async put(key: string, bytes: Uint8Array, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
  }
  async get(key: string, maxBytes = 48_000_000) {
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!head.ContentLength || head.ContentLength > maxBytes)
      throw new Error("Stored object exceeds its budget.");
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body) throw new Error("Stored object is missing.");
    return result.Body.transformToByteArray();
  }
  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
  async uploadUrl(key: string, byteLength: number) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: "audio/ogg",
        ContentLength: byteLength,
      }),
      {
        expiresIn: 300,
        signableHeaders: new Set(["content-type", "content-length"]),
      },
    );
  }
}
export class LocalPrivateStorage implements PrivateStorage {
  constructor(private folder: string) {}
  private path(key: string) {
    if (!/^[a-zA-Z0-9/_-]+(?:\.[a-z]+)?$/.test(key) || key.includes(".."))
      throw new Error("Invalid object key.");
    return resolve(this.folder, key);
  }
  async put(key: string, bytes: Uint8Array) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    const temp = path + "." + randomUUID();
    await writeFile(temp, bytes, { mode: 0o600 });
    await rename(temp, path);
  }
  async get(key: string) {
    return readFile(this.path(key));
  }
  async delete(key: string) {
    await unlink(this.path(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}

/** Application encryption is separate from bucket access and provider-managed encryption. */
export class EncryptedPrivateStorage implements PrivateStorage {
  private key: Buffer;
  constructor(
    private underlying: PrivateStorage,
    secret: string,
  ) {
    if (secret.length < 32)
      throw new Error("Configure a stable private storage key.");
    this.key = createHash("sha256")
      .update("school-object-storage-v1:" + secret)
      .digest();
  }
  async put(key: string, bytes: Uint8Array, contentType: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(key));
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    await this.underlying.put(
      key,
      Buffer.concat([Buffer.from("COT2"), iv, cipher.getAuthTag(), ciphertext]),
      "application/octet-stream",
    );
  }
  async get(key: string, maxBytes = 48_000_000) {
    const bytes = Buffer.from(await this.underlying.get(key, maxBytes + 32));
    // Signed uploads are private, temporary raw teacher audio; publication re-encrypts it.
    if (key.startsWith("uploads/")) {
      if (bytes.length > maxBytes)
        throw new Error("Upload exceeds its budget.");
      return bytes;
    }
    if (bytes.length < 33 || bytes.subarray(0, 4).toString() !== "COT2")
      throw new Error(
        "Private object is not an authenticated encrypted object.",
      );
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      bytes.subarray(4, 16),
    );
    decipher.setAAD(Buffer.from(key));
    decipher.setAuthTag(bytes.subarray(16, 32));
    return Buffer.concat([
      decipher.update(bytes.subarray(32)),
      decipher.final(),
    ]);
  }
  async delete(key: string) {
    await this.underlying.delete(key);
  }
  async uploadUrl(key: string, byteLength: number) {
    if (!key.startsWith("uploads/") || !this.underlying.uploadUrl)
      throw new Error("Signed upload is unavailable for this key.");
    return this.underlying.uploadUrl(key, byteLength);
  }
}
