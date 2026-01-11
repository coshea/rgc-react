export {};

declare global {
  // Used by test-only AuthProvider mocks to simulate current auth user.
  // Kept as `unknown` so tests can set any shape they need without `as any`.
  // Prefer assigning a real Firebase `User` object shape when possible.
  // eslint-disable-next-line no-var
  var __TEST_AUTH_USER: unknown;
}
