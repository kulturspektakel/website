import type {SessionData} from '@remix-run/node';
import {createCookieSessionStorage} from '@remix-run/node';
import type {CookieData} from '~/routes/booking.bewerbung.$applicationType.$step';

const {getSession, commitSession, destroySession} = createCookieSessionStorage<
  SessionData,
  {data: CookieData}
>({
  // a Cookie from `createCookie` or the CookieOptions to create one
  cookie: {
    name: 'booking_application',

    // all of these are optional
    // domain: 'remix.run',
    httpOnly: true,
    maxAge: 60 * 30,
    path: '/',
    sameSite: 'lax',
    secrets: ['s3cret1'],
    // secure: true,
  },
});

export {getSession, commitSession, destroySession};
