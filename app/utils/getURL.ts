import {createServerFn} from '@tanstack/react-start';
import {getRequestURL} from '@tanstack/react-start/server';

export const getURL = createServerFn().handler(() =>
  getRequestURL().toString(),
);
