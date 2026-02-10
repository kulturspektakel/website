import {createServerFn} from '@tanstack/react-start';
import {getCookie} from '@tanstack/react-start/server';
import {redirect} from '@tanstack/react-router';
import {prismaClient} from '../../utils/prismaClient.server';
import {scheduleTask} from '../../utils/scheduleTask.server';
import {addMinutes} from 'date-fns';
import {LOGIN_URL} from '../../routes/nuclino-sso';

export const beforeLoad = createServerFn()
  .inputValidator((query: Record<string, any>) => query)
  .handler(({data}) => {
    const nonce = getCookie('nonce');
    if (nonce) {
      const url = new URL(LOGIN_URL);
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
    const nonceRequest = await prismaClient.nonceRequest.create({
      data: {
        expiresAt: addMinutes(new Date(), 5),
      },
    });

    await scheduleTask('createNonceRequest', {
      id: nonceRequest.id,
      email: data.email,
    });

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

    const {nonce} = await prismaClient.nonce.create({
      data: {
        expiresAt: addMinutes(new Date(), 5),
        createdForId: nonceRequest.createdForId,
      },
    });

    return nonce;
  });
