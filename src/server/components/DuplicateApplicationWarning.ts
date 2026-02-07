import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';

export const getDuplicateApplication = createServerFn()
  .inputValidator((data: {bandname: string; eventId: string}) => data)
  .handler(async ({data}) => {
    const application = await prismaClient.bandApplication.findFirst({
      where: {
        bandname: {
          equals: data.bandname,
          mode: 'insensitive',
        },
        eventId: data.eventId,
      },
    });

    if (application == null) {
      return null;
    }

    return {
      obfuscatedEmail: application.email
        .split('@')
        .map((s, i) => {
          let tld = '';
          if (i === 1 && s.indexOf('.') > -1) {
            tld = '.' + s.split('.').pop();
          }
          return s.charAt(0) + '***' + tld;
        })
        .join('@'),
      applicationTime: application.createdAt,
    };
  });
