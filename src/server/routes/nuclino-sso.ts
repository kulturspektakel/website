import {createServerFn} from '@tanstack/react-start';
import {getCookie} from '@tanstack/react-start/server';
import {redirect} from '@tanstack/react-router';

const LOGIN_URL = 'https://api.kulturspektakel.de/saml/login';

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
