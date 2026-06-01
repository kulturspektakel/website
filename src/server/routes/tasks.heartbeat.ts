/**
 * Scheduled task hit every 5 minutes by Cloud Scheduler. Currently a demo —
 * just logs that it ran. Returns 204 so Cloud Scheduler records success.
 */
export async function handleHeartbeat(): Promise<Response> {
  console.log(`[heartbeat] tick at ${new Date().toISOString()}`);
  return new Response(null, {status: 204});
}
