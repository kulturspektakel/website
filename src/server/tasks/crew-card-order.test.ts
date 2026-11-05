import {describe, expect, test, vi} from 'vitest';

vi.mock('../../server/db.server', () => ({db: {}}));

const {orderMessage} = await import('./crew-card-order');

const ausschank = {productList: {name: 'Ausschank'}};
const order = {orderItems: [{amount: 1, perUnitPrice: 350, ...ausschank}]};

describe('orderMessage', () => {
  test('the order: total and product list', () => {
    expect(
      orderMessage(
        {
          orderItems: [
            {amount: 1, perUnitPrice: 250, ...ausschank},
            {amount: 2, perUnitPrice: 50, ...ausschank},
          ],
        },
        [],
      ),
    ).toBe('3,50€ (Ausschank)');
  });

  test('a new badge by name, several by count', () => {
    expect(orderMessage(order, ['earlyBird'])).toBe(
      '3,50€ (Ausschank), neuer Badge: Early Bird',
    );
    expect(orderMessage(order, ['earlyBird', 'lokalPatriot'])).toBe(
      '3,50€ (Ausschank), 2 neue Badges',
    );
  });

  test('without a product list', () => {
    expect(
      orderMessage(
        {orderItems: [{amount: 1, perUnitPrice: 0, productList: null}]},
        [],
      ),
    ).toBe('0,00€');
  });
});
