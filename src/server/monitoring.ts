export type ErrorCode =
  | 'api_unexpected'
  | 'provider_failed'
  | 'framework_failed'
  | 'job_account_failed'
  | 'scheduler_failed'
  | 'analytics_failed'
  | 'push_failed';

// Fixed codes only: never accept error objects, URLs, user IDs, headers or bodies.
export function reportError(code: ErrorCode) {
  console.error(
    JSON.stringify({ level: 'error', service: 'encore', code, time: new Date().toISOString() }),
  );
}
