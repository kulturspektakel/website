import {addToMailingList} from '../../../utils/addToMailingList.server';

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/slack/mailingList.ts`.
 * The `/mailingliste <email>` slash command adds an address to
 * orga@kulturspektakel.de.
 */
export async function handleMailingListCommand(
  request: Request,
): Promise<Response> {
  const form = await request.formData();
  const email = String(form.get('text') ?? '')
    .trim()
    .toLowerCase();

  if (!email) {
    return Response.json({
      text: '⚠️ Ungültiges Slash-Command. Email-Adresse fehlt!',
    });
  }

  const added = await addToMailingList(email);
  return Response.json({
    text: added
      ? `${email} wurde zur Mailingliste orga@kulturspektakel.de hinzugefügt`
      : `${email} ist bereits in der Mailingliste orga@kulturspektakel.de`,
  });
}
