/** Accessible route-shaped skeleton contains no cached private content. */
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading page">
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton" />
      <span role="status" className="sr-only">
        Loading…
      </span>
    </main>
  );
}
