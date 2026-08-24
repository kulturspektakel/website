/**
 * The router's `defaultPendingComponent` — what stands in for a route's content
 * while its loader runs.
 *
 * Deliberately built from plain elements and inline styles, with no Chakra and no
 * hooks. Setting `defaultPendingComponent` does more than supply a pending view:
 * it makes this the Suspense fallback for *every* match (see `Match.tsx`, where
 * `ResolvedSuspenseBoundary` becomes `React.Suspense` as soon as a pending
 * component exists). So it can render at a layout route's own position — above
 * `MainLayout`/`CrewLayout`, and therefore outside the `ChakraProvider` they
 * mount. A Chakra `Spinner` here throws a ContextError during SSR.
 *
 * The two layouts also use different themes (`theme` vs `crewTheme`), so hoisting
 * one provider to the root isn't an option either.
 *
 * `currentColor` so it reads correctly on the light site and the dark noise area
 * alike, and `minHeight` so a slow page doesn't collapse and yank the footer up
 * the viewport only to drop it back when content lands.
 */
const SPINNER_CSS = `
@keyframes kult-pending-spin { to { transform: rotate(360deg) } }
@media (prefers-reduced-motion: reduce) {
  .kult-pending-spinner { animation-duration: 2.4s }
}
`;

export function Pending() {
  return (
    <div
      style={{
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>{SPINNER_CSS}</style>
      <div
        className="kult-pending-spinner"
        role="progressbar"
        aria-label="Wird geladen"
        style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          border: '3px solid currentColor',
          borderTopColor: 'transparent',
          opacity: 0.35,
          animation: 'kult-pending-spin 0.7s linear infinite',
        }}
      />
    </div>
  );
}
