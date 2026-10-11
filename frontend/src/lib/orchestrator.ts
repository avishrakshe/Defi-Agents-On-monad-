/**
 * Base URL of the orchestrator API.
 * - NEXT_PUBLIC_ORCHESTRATOR_URL wins when it is set at build time.
 * - Otherwise: the deployed backend on any real host, and the local orchestrator (port 4000) on localhost.
 * Resolved at call time so it always reflects the page the user is actually on.
 */
export const DEPLOYED_ORCHESTRATOR_URL = "https://defi-agents-backend.vercel.app";

export function getOrchestratorUrl(): string {
  if (process.env.NEXT_PUBLIC_ORCHESTRATOR_URL) return process.env.NEXT_PUBLIC_ORCHESTRATOR_URL;
  if (typeof window !== "undefined" && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) {
    return DEPLOYED_ORCHESTRATOR_URL;
  }
  return "http://localhost:4000";
}
