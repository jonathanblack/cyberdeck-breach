import { defineConfig } from 'vite';

// The build tag in the top bar: which commit (and branch) this page is. Cloudflare Workers Builds sets these.
const branch = process.env.WORKERS_CI_BRANCH ?? '';
const sha = (process.env.WORKERS_CI_COMMIT_SHA ?? '').slice(0, 7) || 'local';
const build = branch ? `${sha} · ${branch.replace(/^claude\//, '')}` : sha;

export default defineConfig({
  define: { __BUILD__: JSON.stringify(build) },
});
