import type {UIMatch} from '@remix-run/react';
import {useMatches} from '@remix-run/react';
import type {loader} from '../root';

export function rootData(
  matches: UIMatch<any, unknown>[],
): Awaited<ReturnType<Awaited<ReturnType<typeof loader>>['typedjson']>> {
  const root = matches.find((m) => m.id === 'root');
  return root?.data;
}

export default function useRootData() {
  const matches = useMatches();
  return rootData(matches);
}
