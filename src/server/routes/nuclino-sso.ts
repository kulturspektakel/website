import {createServerFn} from '@tanstack/react-start';
import {getCookie} from '@tanstack/react-start/server';
import {redirect} from '@tanstack/react-router';
import {addMinutes} from 'date-fns';
import {prismaClient} from '../../utils/prismaClient.server';
import {enqueueGcpTask} from '../../utils/enqueueGcpTask.server';
import {LOGIN_URL} from '../../routes/_main.nuclino-sso';

const NONCE_LIFETIME_MINUTES = 5;

export const beforeLoad = createServerFn()
  .inputValidator((query: Record<string, any>) => query)
  .handler(({data}) => {
    const nonce = getCookie('nonce');
    if (nonce) {
      const url = new URL(LOGIN_URL, process.env.SITE_URL);
      Object.entries(data).forEach(([key, value]) =>
        url.searchParams.set(key, value),
      );
      url.searchParams.set('nonce', nonce);
      throw redirect({
        href: url.toString(),
      });
    }
    if (!data['SAMLRequest']) {
      throw redirect({
        href: 'https://app.nuclino.com/Kulturspektakel/login',
      });
    }
  });

export const createNonceRequest = createServerFn()
  .inputValidator((data: {email: string}) => data)
  .handler(async ({data}) => {
    const expiresAt = addMinutes(new Date(), NONCE_LIFETIME_MINUTES);
    const nonceRequest = await prismaClient.nonceRequest.create({
      data: {
        expiresAt,
        createdForEmail: data.email,
      },
    });

    await Promise.all([
      // Sends the Slack DM with approve/reject buttons.
      enqueueGcpTask('create-nonce-request', {
        id: nonceRequest.id,
        email: data.email,
      }),
      // Cleans up the row if the user never approves it.
      enqueueGcpTask(
        'nonce-request-invalidate',
        {nonceRequestId: nonceRequest.id},
        {scheduleAt: expiresAt},
      ),
    ]);

    return nonceRequest.id;
  });

export const checkNonceRequest = createServerFn()
  .inputValidator((data: {nonceRequestId: string}) => data)
  .handler(async ({data}) => {
    const nonceRequest = await prismaClient.nonceRequest.findUnique({
      where: {
        id: data.nonceRequestId,
        expiresAt: {gt: new Date()},
        status: 'Approved',
      },
      include: {createdFor: true},
    });

    if (!nonceRequest) {
      return null;
    }

    const expiresAt = addMinutes(new Date(), NONCE_LIFETIME_MINUTES);
    const {nonce} = await prismaClient.nonce.create({
      data: {
        expiresAt,
        createdForId: nonceRequest.createdForId,
      },
    });
    await enqueueGcpTask(
      'nonce-invalidate',
      {nonce},
      {scheduleAt: expiresAt},
    );

    return nonce;
  });
