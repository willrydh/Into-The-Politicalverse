export function DataSource({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={compact ? "data-source data-source--compact" : "data-source"}
      href="https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022"
      target="_blank"
      rel="noreferrer"
    >
      <span className="data-source__icon" aria-hidden="true">V</span>
      <span>
        <strong>Official data</strong>
        <small>Valmyndigheten ↗</small>
      </span>
    </a>
  );
}
