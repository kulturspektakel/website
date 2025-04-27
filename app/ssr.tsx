import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';
import {getRouterManifest} from '@tanstack/react-start/router-manifest';
import * as Sentry from '@sentry/tanstackstart-react';
import {createRouter} from './router';

export default createStartHandler({
  createRouter,
  getRouterManifest,
})(Sentry.wrapStreamHandlerWithSentry(defaultStreamHandler));
