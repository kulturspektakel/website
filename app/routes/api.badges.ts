import {json} from '@tanstack/react-start';
import {createAPIFileRoute} from '@tanstack/react-start/api';
import {computeBadges} from '../utils/useBadges';
import {orderToCardActivity, queryCrewCard} from '../utils/cardUtils';
import {badgeConfig} from '../utils/badgeConfig';
import {getCurrentEvent} from '../utils/getCurrentEvent';
import {BadgeSVG} from '../components/kultcard/Badges';
import {renderToString} from 'react-dom/server';
import React from 'react';

// This is stupid. This is an API called by the API to figure out
// if a new badge was awarded with an order. This shouldn't exist
// but would require the badges implementation to be available in
// api.kulturspektakel.de
export const APIRoute = createAPIFileRoute('/api/badges')({
  POST: async ({request}) => {
    const {cardId, orderId} = (await request.json()) as {
      cardId: string;
      orderId: number;
    };
    if (!cardId || !orderId) {
      throw new Error('invalid input');
    }
    const event = await getCurrentEvent();
    const _crewCard = await queryCrewCard(cardId, event);
    if (!_crewCard) {
      throw new Error('crew card does not exists');
    }

    const oldActivities = orderToCardActivity(
      _crewCard.Order.filter((o) => o.id !== orderId),
    );
    const newActivities = orderToCardActivity(_crewCard.Order);
    const oldBadges = computeBadges(oldActivities, event, true).filter(
      (b) => b.status === 'awarded',
    );
    const newBadges = computeBadges(newActivities, event, true).filter(
      (b) => b.status === 'awarded',
    );

    const newlyAwardedBadges = newBadges.filter((nb) =>
      oldBadges.every((ob) => ob.badgeKey !== nb.badgeKey),
    );

    return json(
      newlyAwardedBadges.map(({badgeKey, awardedAt}) => ({
        key: badgeKey,
        name: badgeConfig[badgeKey].name,
        description: badgeConfig[badgeKey].description,
        crewOnly: badgeConfig[badgeKey].crewOnly,
        awardedAt,
        svg: renderToString(React.createElement(BadgeSVG, {type: badgeKey})),
      })),
    );
  },
});
