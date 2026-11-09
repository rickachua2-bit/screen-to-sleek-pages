import type { ReactNode } from "react";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Slim hero for trust & legal pages — no illustration, just type. */
export function LegalHero({ kicker, title, sub, updated }: { kicker: string; title: string; sub: string; updated?: string }) {
  return (
    <section className="mkt-pagehero">
      <div className="mkt-container">
        <span className="mkt-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{sub}</p>
        {updated ? <p className="mkt-legal-updated">Last updated: {updated}</p> : null}
      </div>
    </section>
  );
}

/** Numbered legal document with a sticky table of contents on desktop. */
export function LegalDoc({ sections }: { sections: LegalSection[] }) {
  return (
    <section className="mkt-section">
      <div className="mkt-container mkt-legal-layout">
        <nav className="mkt-legal-toc" aria-label="On this page">
          <strong>On this page</strong>
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`}>{i + 1}. {s.title}</a>
          ))}
        </nav>
        <div className="mkt-legal-doc">
          {sections.map((s, i) => (
            <article key={s.id} id={s.id} className="mkt-legal-section mkt-reveal">
              <h2><span className="mkt-legal-num">{String(i + 1).padStart(2, "0")}</span>{s.title}</h2>
              {s.body}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
