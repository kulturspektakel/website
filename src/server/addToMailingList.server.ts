// Scoped package instead of the `googleapis` metapackage — see gmail.server.ts.
import {admin, auth} from '@googleapis/admin';

/**
 * Migrated from `~/api.kulturspektakel.de/src/utils/addToMailingList.ts`.
 *
 * Adds an email to the `orga@kulturspektakel.de` Google Workspace group
 * (groupKey `04du1wux1n28nki`) via the Admin Directory API. Returns `true` if
 * added, `false` if the address was already a member. Reuses the same
 * Workspace-delegated service account as `gmail.server.ts`.
 */
const GROUP_KEY = '04du1wux1n28nki'; // orga@kulturspektakel.de

export async function addToMailingList(email: string): Promise<boolean> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    '\n',
  );
  if (!serviceAccountEmail || !key) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY not set',
    );
  }

  const jwt = new auth.JWT({
    email: serviceAccountEmail,
    key,
    scopes: ['https://www.googleapis.com/auth/admin.directory.group.member'],
  });
  await jwt.authorize();

  try {
    await admin({auth: jwt, version: 'directory_v1'}).members.insert({
      groupKey: GROUP_KEY,
      requestBody: {email},
    });
    return true;
  } catch (e) {
    if ((e as {code?: number}).code === 409) {
      return false; // already a member
    }
    throw e;
  }
}
