import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      JWT_SECRET: 'test-jwt-secret',
      RESEND_API_KEY: 're_test_key_for_vitest',
    },
  },
});