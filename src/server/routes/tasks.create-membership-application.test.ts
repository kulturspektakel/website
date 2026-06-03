import {beforeEach, describe, expect, test, vi} from 'vitest';

const {enqueueGcpTask} = vi.hoisted(() => ({enqueueGcpTask: vi.fn()}));
const {slackApiRequest} = vi.hoisted(() => ({slackApiRequest: vi.fn()}));

vi.mock('../../utils/enqueueGcpTask.server', () => ({enqueueGcpTask}));
vi.mock('../../utils/slack.server', () => ({slackApiRequest}));

const {handleCreateMembershipApplication} = await import(
  './tasks.create-membership-application'
);

function membershipRequest(body: unknown) {
  return new Request('https://example.test/x', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {'content-type': 'application/json'},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  enqueueGcpTask.mockResolvedValue(undefined);
  slackApiRequest.mockResolvedValue({ok: true});
});

describe('handleCreateMembershipApplication', () => {
  test('kult regular: announces on Slack and sends both emails', async () => {
    const res = await handleCreateMembershipApplication(
      membershipRequest({
        membership: 'kult',
        membershipType: 'regular',
        accountHolder: 'same',
        name: 'Erika Musterfrau',
        address: 'Musterstr. 1',
        city: '82131 Gauting',
        email: 'erika@example.test',
        iban: 'DE89370400440532013000',
      }),
    );
    expect(res.status).toBe(204);

    expect(slackApiRequest).toHaveBeenCalledWith('chat.postMessage', {
      channel: 'C030FV86XKR',
      text: 'Erika Musterfrau ist jetzt Mitglied im Kulturspektakel Gauting e.V.',
    });

    // Internal notification to the Kasse mailbox.
    expect(enqueueGcpTask).toHaveBeenCalledWith('send-email', {
      from: 'Kulturspektakel Gauting <info@kulturspektakel.de>',
      to: 'Kulturspektakel Gauting Kasse <kasse@kulturspektakel.de>',
      subject: 'Mitgliedsantrag Erika Musterfrau',
      text: expect.stringContaining('Mitgliedsbeitrag: 30,00 €'),
    });

    // Confirmation email to the member, masking the IBAN.
    expect(enqueueGcpTask).toHaveBeenCalledWith('send-email', {
      from: 'Kulturspektakel Gauting Kasse <kasse@kulturspektakel.de>',
      to: 'erika@example.test',
      template: 'confirmMembership',
      variables: {
        iban: 'DE893**************000',
        senderEmail: 'kasse@kulturspektakel.de',
        membership: 'Kulturspektakel Gauting e.V.',
        membershipFee: '30,00 €',
      },
    });
  });

  test('foerderverein supporter: uses Förderverein sender and custom fee', async () => {
    await handleCreateMembershipApplication(
      membershipRequest({
        membership: 'foerderverein',
        membershipType: 'supporter',
        membershipFee: 5000,
        accountHolder: 'same',
        name: 'Max Mustermann',
        address: 'Musterstr. 2',
        city: '82131 Gauting',
        email: 'max@example.test',
        iban: 'DE89370400440532013000',
      }),
    );

    expect(slackApiRequest).toHaveBeenCalledWith('chat.postMessage', {
      channel: 'C030FV86XKR',
      text: 'Max Mustermann ist jetzt Mitglied im Förderverein Kulturspektakel Gauting e.V. mit einem Förderbeitrag von 50,00 €',
    });
    expect(enqueueGcpTask).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({
        from: 'Förderverein Kulturspektakel Gauting <foerderverein@kulturspektakel.de>',
        to: 'max@example.test',
        variables: expect.objectContaining({
          senderEmail: 'foerderverein@kulturspektakel.de',
          membershipFee: '50,00 €',
        }),
      }),
    );
  });
});
