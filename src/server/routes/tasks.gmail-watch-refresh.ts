import {GMAIL_ACCOUNTS, gmailClient} from '../../utils/gmail.server';

const PUBSUB_TOPIC = 'projects/gmail-reminder-api/topics/mail-reminder';

/**
 * Daily cron (Cloud Scheduler) that refreshes the Gmail Pub/Sub watch on each
 * of our 3 accounts. Gmail watches expire after 7 days, so renewing every 24h
 * keeps them healthy. Replaces the legacy `gmailSubscription` task.
 */
export async function handleGmailWatchRefresh(): Promise<Response> {
  const results = await Promise.allSettled(
    GMAIL_ACCOUNTS.map(async (account) => {
      const gmail = await gmailClient(account);
      await gmail.users.watch({
        userId: 'me',
        requestBody: {
          labelIds: ['INBOX'],
          topicName: PUBSUB_TOPIC,
        },
      });
    }),
  );

  const failed = results
    .map((r, i) => ({result: r, account: GMAIL_ACCOUNTS[i]}))
    .filter(({result}) => result.status === 'rejected');
  if (failed.length > 0) {
    for (const {account, result} of failed) {
      console.error(
        `[gmail-watch-refresh] ${account} failed:`,
        (result as PromiseRejectedResult).reason,
      );
    }
    return new Response('partial failure', {status: 500});
  }
  return new Response(null, {status: 204});
}
