function requiredEnv(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(
      `Missing ${name}. Set it in your environment (e.g. .env.local or GitHub Actions).`,
    );
  }
  return value.trim();
}

export function getFirebaseFunctionsBaseUrl(): string {
  const baseUrl = requiredEnv(
    "VITE_FIREBASE_FUNCTIONS_BASE_URL",
    import.meta.env.VITE_FIREBASE_FUNCTIONS_BASE_URL,
  );

  return baseUrl.replace(/\/$/, "");
}
