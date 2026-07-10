let envValidated = false;

export function assertRequiredEnv() {
  if (envValidated) {
    return;
  }

  envValidated = true;

  const authSecret = process.env.AUTH_SECRET;

  if (!authSecret || authSecret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set and at least 32 characters. Generate one with: openssl rand -base64 32"
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }
}
