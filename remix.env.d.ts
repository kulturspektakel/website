/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />

// extend window
interface Window {
  google: any;
  __APOLLO_STATE__: any;
}
