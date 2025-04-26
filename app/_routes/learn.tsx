import type {LoaderFunctionArgs} from '@remix-run/node';
import {SitemapFunction} from 'remix-sitemap';
import {redirect} from 'remix-typedjson';

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader(args: LoaderFunctionArgs) {
  throw redirect('https://www.youtube.com/watch?v=2arxBGrjBgI');
}
