// `server-only` throws when resolved under a browser condition, which is what makes it a
// useful build guard — and what breaks vitest's jsdom environment. Tests import the server
// modules directly, so the stub stands in for it.
export {};
