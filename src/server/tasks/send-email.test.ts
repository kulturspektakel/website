import {beforeEach, describe, expect, test, vi} from 'vitest';

const {sendMail} = vi.hoisted(() => ({sendMail: vi.fn()}));
const {templateFn} = vi.hoisted(() => ({
  templateFn: vi.fn().mockReturnValue({
    subject: 'rendered subject',
    html: '<p>rendered html</p>',
    text: 'rendered text',
  }),
}));

vi.mock('../../server/sendMail.server', () => ({
  transport: {sendMail},
}));
vi.mock('../../../maizzle/generated', () => ({
  default: {
    confirmBandApplication: templateFn,
  },
}));

const {handleSendEmail} = await import('./send-email');

function emailRequest(body: unknown) {
  return new Request('https://example.test/x', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {'content-type': 'application/json'},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMail.mockResolvedValue({});
});

describe('handleSendEmail', () => {
  test('template payload: renders template + forwards to SES', async () => {
    const res = await handleSendEmail(
      emailRequest({
        from: 'Kulturspektakel Gauting <info@kulturspektakel.de>',
        to: 'someone@example.test',
        template: 'confirmBandApplication',
        variables: {bandname: 'Tester', eventYear: '2026'},
      }),
    );
    expect(res.status).toBe(204);
    expect(templateFn).toHaveBeenCalledWith({bandname: 'Tester', eventYear: '2026'});
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Kulturspektakel Gauting <info@kulturspektakel.de>',
      to: 'someone@example.test',
      subject: 'rendered subject',
      html: '<p>rendered html</p>',
      text: 'rendered text',
    });
  });

  test('raw payload: passes subject + text straight through', async () => {
    const res = await handleSendEmail(
      emailRequest({
        from: 'Kulturspektakel Gauting <info@kulturspektakel.de>',
        to: 'someone@example.test',
        subject: 'hi',
        text: 'plain body',
      }),
    );
    expect(res.status).toBe(204);
    expect(templateFn).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Kulturspektakel Gauting <info@kulturspektakel.de>',
      to: 'someone@example.test',
      subject: 'hi',
      text: 'plain body',
    });
  });

  test('caller-provided fields override template fields (e.g. replyTo)', async () => {
    await handleSendEmail(
      emailRequest({
        from: 'Kulturspektakel Gauting <info@kulturspektakel.de>',
        to: 'someone@example.test',
        replyTo: 'booking@kulturspektakel.de',
        template: 'confirmBandApplication',
        variables: {bandname: 'Tester', eventYear: '2026'},
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({replyTo: 'booking@kulturspektakel.de'}),
    );
  });
});
