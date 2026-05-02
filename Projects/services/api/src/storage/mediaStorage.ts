import path from "path";
import { Readable } from "stream";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { LocalStorageAdapter } from "./local";

type SaveFileArgs = {
  id: string;
  filename: string;
  buffer: Buffer;
  contentType: string;
};

type SavedFile = {
  id: string;
  filename: string;
  urlPath: string;
  storageKey: string;
  storagePath?: string;
};

type MediaStorageAdapter = {
  saveFile: (args: SaveFileArgs) => Promise<SavedFile>;
  readFile: (storageKey: string, filename: string, storagePath?: string) => Promise<Buffer>;
};

const localStorage = new LocalStorageAdapter(path.join(process.cwd(), "storage", "uploads"));
let s3Client: S3Client | null = null;

function useS3Storage() {
  return (
    ["s3", "aws", "r2"].includes(String(process.env.MEDIA_STORAGE_PROVIDER || "").trim().toLowerCase()) ||
    Boolean(
      (process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.R2_BUCKET) &&
        (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID) &&
        (process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY)
    )
  );
}

function getS3Config() {
  const provider = String(process.env.MEDIA_STORAGE_PROVIDER || "").trim().toLowerCase();
  const bucket =
    String(process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.R2_BUCKET || "").trim();
  const region =
    String(process.env.S3_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "auto").trim();
  const accessKeyId =
    String(process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey =
    String(
      process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || ""
    ).trim();
  const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
  const derivedR2Endpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined;

  return {
    provider,
    bucket,
    region,
    endpoint: String(process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || "").trim() || derivedR2Endpoint,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || provider === "r2",
  };
}

function getS3Client() {
  if (s3Client) return s3Client;
  const config = getS3Config();
  s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return s3Client;
}

function buildStorageKey(id: string, filename: string) {
  return `uploads/${id}-${filename}`;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Unsupported media response body.");
}

const adapter: MediaStorageAdapter = {
  async saveFile({ id, filename, buffer, contentType }) {
    if (!useS3Storage()) {
      const saved = await localStorage.saveFile({ id, filename, buffer });
      return {
        id,
        filename,
        urlPath: `/api/uploads/${id}/${encodeURIComponent(filename)}`,
        storageKey: buildStorageKey(id, filename),
        storagePath: saved.filepath,
      };
    }

    const config = getS3Config();
    const storageKey = buildStorageKey(id, filename);
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: contentType || "application/octet-stream",
      })
    );

    return {
      id,
      filename,
      urlPath: `/api/uploads/${id}/${encodeURIComponent(filename)}`,
      storageKey,
    };
  },

  async readFile(storageKey, filename, storagePath) {
    if (!useS3Storage()) {
      const basename = storageKey.replace(/^uploads\//, "");
      const separatorIndex = basename.lastIndexOf(`-${filename}`);
      const id = separatorIndex > -1 ? basename.slice(0, separatorIndex) : basename;
      const filepath = storagePath || localStorage.getFilePath(id, filename);
      return localStorage.readFile(filepath);
    }

    const config = getS3Config();
    const result = await getS3Client().send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
      })
    );

    return streamToBuffer(result.Body);
  },
};

export function getMediaStorage() {
  return adapter;
}

export function isProductionMediaStorageReady() {
  if (!useS3Storage()) return false;
  const config = getS3Config();
  return Boolean(config.bucket && config.accessKeyId && config.secretAccessKey && config.endpoint !== "");
}
