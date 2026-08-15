import {createFileRoute, redirect} from '@tanstack/react-router';

// A project has no view of its own — it is either its map or its list. Every link still
// points here, so this is the one place that decides which one you land on, and it is the
// list: during an event the question is what the stages are reading, and that is a column
// of charts. The map is a view you switch to (and the one place that still needs a Maps
// key, which is why this no longer has to ask whether there is one).
export const Route = createFileRoute('/crew/lautstaerke/projekt/$projectId/')({
  // replace, so the back button returns to wherever you came from instead of bouncing
  // through here again.
  loader: ({params}) => {
    throw redirect({
      to: '/crew/lautstaerke/projekt/$projectId/liste',
      params,
      replace: true,
    });
  },
});
