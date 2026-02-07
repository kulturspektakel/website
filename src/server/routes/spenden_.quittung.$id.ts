import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {redirect} from '@tanstack/react-router';
import z from 'zod';

const FormSchemaWithId = z.object({
  quittungStreet: z.string().min(1),
  quittungCity: z.string().min(1),
  quittungName: z.string().min(1),
  id: z.uuid(),
});

const select = {
  id: true,
  name: true,
  namePrivate: true,
  amount: true,
  createdAt: true,
  source: true,
  spendenQuittungAt: true,
} as const;

export const loader = createServerFn()
  .inputValidator((id: string) => id)
  .handler(async ({data: id}) => {
    const data = await prismaClient.donation.findFirstOrThrow({
      select,
      where: {
        id,
      },
    });

    if (data.spendenQuittungAt) {
      throw redirect({
        to: '/api/spenden/quittung/$id',
        params: {id: data.id},
      });
    }

    return data;
  });

export const setData = createServerFn()
  .inputValidator(FormSchemaWithId)
  .handler(async ({data: {id, ...data}}) => {
    return prismaClient.donation.update({
      where: {
        id,
        spendenQuittungAt: {
          equals: null,
        },
      },
      data: {
        ...data,
        spendenQuittungAt: new Date(),
      },
      select,
    });
  });
