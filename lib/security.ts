import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string) {
  try {
    const [salt, key] = hash.split(":");
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(key, "hex");
    return (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    );
  } catch {
    return false;
  }
}
export const tokenHash = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const randomToken = () => randomBytes(32).toString("hex");
