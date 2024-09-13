import type {LoaderFunctionArgs} from '@remix-run/node';
import {redirect} from 'remix-typedjson';

export async function loader(args: LoaderFunctionArgs) {
  throw redirect('https://www.youtube.com/watch?v=2arxBGrjBgI');
}
