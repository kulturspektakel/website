// Fixed secrets for the e2e dev server, shared by globalSetup (which passes
// them to the server) and the tests (which sign requests with them).
export const E2E_JWT_SECRET = 'e2e-jwt-secret';
