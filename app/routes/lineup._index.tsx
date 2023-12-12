import type {LoaderFunctionArgs} from '@remix-run/node';
import {$path} from 'remix-routes';
import {redirect} from 'remix-typedjson';

export async function loader(args: LoaderFunctionArgs) {
  throw redirect($path('/lineup/:year', {year: 2023}));
}
