import {createFileRoute} from '@tanstack/react-router';
import {prismaClient} from '../server/prismaClient.server';

export const Route = createFileRoute('/api/spenden/quittung/$id')({
  server: {
    handlers: {
      GET: async ({params}) => {
        const origin =
          process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000'
            : 'https://www.kulturspektakel.de';

        const donation = await prismaClient.donation.findFirstOrThrow({
          select: {
            id: true,
            amount: true,
            createdAt: true,
            quittungName: true,
            quittungStreet: true,
            quittungCity: true,
            spendenQuittungAt: true,
          },
          where: {
            id: params.id,
            spendenQuittungAt: {
              not: null,
            },
          },
        });

        // Deliberately dynamic: `@react-pdf/renderer` and its dependencies
        // (brotli, fontkit, pdfkit, yoga-layout) are ~213 ms of cold-start CPU,
        // and a static import here would put them in the shared server chunk
        // that every page render compiles. Deferred to the one request that
        // needs them. See src/server/spendenQuittung.server.tsx.
        const {renderSpendenQuittung} = await import(
          '../server/spendenQuittung.server'
        );

        return new Response(await renderSpendenQuittung({donation, origin}), {
          headers: {'Content-Type': 'application/pdf'},
        });
      },
    },
  },
});
