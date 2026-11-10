import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey() {
  const key = process.env["BEACON_ENCRYPTION_KEY"];
  if (!key || !/^[a-fA-F0-9]{64}$/.test(key))
    throw new Error(
      "Beacon secure storage is not configured. Set BEACON_ENCRYPTION_KEY on the Nexus server.",
    );
  return Buffer.from(key, "hex");
}
export function encryptBeaconKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}
export function decryptBeaconKey(value: string) {
  try {
    const [version, iv, tag, encrypted] = value.split(":");
    if (version !== "v1" || !iv || !tag || !encrypted) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "The saved Beacon key could not be read. An admin must re-enter the API key and save the connection.",
    );
  }
}
