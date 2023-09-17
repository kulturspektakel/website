import type {LoaderArgs} from '@remix-run/node';
import {$path} from 'remix-routes';
import {redirect} from 'remix-typedjson';

export async function loader(args: LoaderArgs) {
  throw redirect($path('/lineup/:year', {year: 2023}));
}
