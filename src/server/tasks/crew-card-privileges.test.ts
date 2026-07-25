import {beforeEach, describe, expect, test, vi} from 'vitest';

const {conversationMembers} = vi.hoisted(() => ({
  conversationMembers: vi.fn(),
}));
const {prismaMock} = vi.hoisted(() => ({
  prismaMock: {crewCard: {updateMany: vi.fn()}},
}));

vi.mock('../../server/slack.server', () => ({conversationMembers}));
vi.mock('../../server/prismaClient.server', () => ({prismaClient: prismaMock}));

const {handleCrewCardPrivileges} = await import('./crew-card-privileges');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.crewCard.updateMany.mockResolvedValue({count: 2});
});

describe('handleCrewCardPrivileges', () => {
  test('privileges the valid, unsuspended cards of #bonbude members', async () => {
    conversationMembers.mockResolvedValue(['U1', 'U2']);

    const res = await handleCrewCardPrivileges();
    expect(res.status).toBe(204);

    expect(conversationMembers).toHaveBeenCalledWith('C0BKU2WSN7K');
    expect(prismaMock.crewCard.updateMany).toHaveBeenCalledWith({
      where: {
        viewerId: {in: ['U1', 'U2']},
        validUntil: {gt: expect.any(Date)},
        suspended: {not: true},
        privileged: {not: true},
      },
      data: {privileged: true},
    });
  });

  test('does not touch any card when the channel is empty', async () => {
    conversationMembers.mockResolvedValue([]);

    const res = await handleCrewCardPrivileges();
    expect(res.status).toBe(204);
    expect(prismaMock.crewCard.updateMany).not.toHaveBeenCalled();
  });
});
