import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

let timingSafeDummyHashPromise: Promise<string> | null = null;

async function getTimingSafeDummyHash() {
  if (!timingSafeDummyHashPromise) {
    timingSafeDummyHashPromise = bcrypt.hash("timing-safe-placeholder", SALT_ROUNDS);
  }

  return timingSafeDummyHashPromise;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function verifyPasswordWithTimingProtection(
  password: string,
  passwordHash?: string | null
) {
  const hash = passwordHash ?? (await getTimingSafeDummyHash());
  return bcrypt.compare(password, hash);
}
