import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient.server';
import {queryCrewCard, orderToCardActivity} from '../utils/cardUtils.server';
import {byteArrayToString, stringToByteArray} from '../utils/cardUtils';
import {decodePayload} from '../utils/decodePayload';
import {notFound} from '@tanstack/react-router';
import {HighscoreEntry} from '../components/kultcard/Highscore';

export const loader = createServerFn()
  .inputValidator(
    (data: {hash: string; event: {start: Date; end: Date}}) => data,
  )
  .handler(async ({data: {hash, event}}) => {
    const {cardId, validUntil} = decodePayload('crewcard', hash);
    const _crewCard = await queryCrewCard(stringToByteArray(cardId), event);

    if (!_crewCard) {
      throw notFound();
    }

    const _highscores = await prismaClient.$queryRaw<
      Array<{
        productListId: number;
        emoji: string | null;
        name: string;
        cardId: Uint8Array;
        nickname: string | null;
        displayName: string | null;
        amount: BigInt;
        rnk: BigInt;
      }>
    >`SELECT * FROM (
          SELECT
            pl.id AS "productListId",
            pl.emoji,
            pl.name,
            c.id AS "cardId",
            c.nickname,
            v."displayName",
            SUM(oi.amount) AS "amount",
            RANK() OVER (PARTITION BY pl.id ORDER BY SUM(oi.amount) DESC) AS rnk
          FROM "ProductList" pl
          JOIN "OrderItem" oi ON oi."productListId" = pl.id
          JOIN "Order" o ON o.id = oi."orderId"
          JOIN "CrewCard" c ON o."crewCardId" = c.id
          JOIN "Viewer" v ON c."viewerId" = v.id
          WHERE pl.active AND o."crewCardId" IS NOT NULL AND o."createdAt" > ${event.start} AND o."createdAt" < ${event.end}
          GROUP BY 1, 2, 3, 4, 5, 6
        ) ranked
        WHERE rnk <= 3
        ORDER BY "productListId", rnk;`;

    const highscores = _highscores.reduce<Record<number, HighscoreEntry[]>>(
      (acc, cv) => {
        if (!acc[cv.productListId]) {
          acc[cv.productListId] = [];
        }
        acc[cv.productListId].push({
          name: cv.displayName || cv.nickname || 'Unbekannt',
          cardId: byteArrayToString(cv.cardId),
          amount: Number(cv.amount),
          rank: Number(cv.rnk),
          productList: cv.name,
          emoji: cv.emoji,
        });
        return acc;
      },
      {},
    );

    const {Order, ...crewCard} = _crewCard;

    return {
      highscores,
      crewCard,
      cardActivities: orderToCardActivity(Order),
      totals: {
        Buchungen: Order.reduce(
          (acc, cv) => acc + cv.items.reduce((acc, cv) => acc + cv.amount, 0),
          0,
        ),
        Badges: 0 as number,
        Highscores: Object.values(highscores)
          .flatMap((v) => v)
          .reduce((acc, cv) => (cv.cardId === cardId ? acc + 1 : acc), 0),
      },
      event,
      cardId,
      validUntil,
    };
  });
