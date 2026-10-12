"use client";
import uiStyles from "./../../styles/ui.module.css";

import { SeasonTemplate } from "../season-template";
import { Field } from "../ui";
import type { TrackerViewContext } from "./context";
/** Render admin-seasons using current controller state and explicit actions. */
export function AdminSeasonsView(context: TrackerViewContext) {
  const { account, seasons, loaded, run, view, id } = context;
  return (
    <>
      {view === "admin-seasons" && (
        <>
          <h1>Manage seasons</h1>
          {account?.admin ? (
            <>
              <form
                className={uiStyles.card}
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  void run({
                    command: "CreateSeason",
                    title: data.get("title"),
                    slug: data.get("slug"),
                    description: data.get("description") || undefined,
                  });
                }}
              >
                <Field label="Season URL identifier">
                  <input
                    required
                    name="slug"
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    maxLength={80}
                  />
                </Field>
                <Field label="Season title">
                  <input required name="title" maxLength={200} />
                </Field>
                <Field label="Season description">
                  <textarea name="description" maxLength={4000} />
                </Field>
                <button type="submit" className={uiStyles.button}>
                  Create draft season
                </button>
              </form>
              <div className={uiStyles.columns}>
                <aside className={"sidebar"} aria-label="Season editor list">
                  {seasons.map((s) => (
                    <a key={s.id} href={`/admin/seasons/${s.id}`}>
                      {s.title} · {s.state}
                      {s.featured ? " · Featured" : ""}
                    </a>
                  ))}
                </aside>
                <div>
                  {seasons
                    .filter((s) => s.id === id)
                    .map((s) => (
                      <article className={uiStyles.card} key={s.id}>
                        <h2>{s.title}</h2>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const d = new FormData(e.currentTarget);
                            void run({
                              command: "SaveSeason",
                              seasonId: s.id,
                              expectedSeasonVersion: s.version,
                              title: d.get("title"),
                              description: d.get("description"),
                              slug: d.get("slug"),
                              ...(!s.publishedAt &&
                              s.state === "published" &&
                              d.get("publishedAt")
                                ? {
                                    publishedAt: new Date(
                                      String(d.get("publishedAt"))
                                    ).toISOString(),
                                  }
                                : {}),
                            });
                          }}
                        >
                          <Field label="Season title">
                            <input
                              required
                              name="title"
                              defaultValue={s.title}
                              maxLength={200}
                            />
                          </Field>
                          <Field label="Description">
                            <textarea
                              name="description"
                              defaultValue={s.description ?? ""}
                              maxLength={4000}
                            />
                          </Field>
                          <Field label="URL identifier">
                            <input
                              required
                              name="slug"
                              defaultValue={s.slug}
                              readOnly={s.state === "published"}
                              pattern="[a-z0-9]+(-[a-z0-9]+)*"
                            />
                          </Field>
                          {!s.publishedAt && s.state === "published" && (
                            <Field label="Verified first publication instant (UTC)">
                              <input type="datetime-local" name="publishedAt" />
                            </Field>
                          )}
                          <button type="submit" className={uiStyles.button}>
                            Save season details
                          </button>
                        </form>
                        <p>
                          {s.state} · {s.featured ? "Featured" : "Not featured"}
                        </p>
                        {s.state === "draft" && (
                          <button
                            type="button"
                            onClick={() =>
                              run({
                                command: "PublishSeason",
                                seasonId: s.id,
                                expectedSeasonVersion: s.version,
                              })
                            }
                            className={uiStyles.button}
                          >
                            Publish {s.title}
                          </button>
                        )}
                        <button
                          type="button"
                          className={`${uiStyles.button} ${uiStyles.secondary}`}
                          onClick={() =>
                            run({
                              command: "SetSeasonFeatured",
                              seasonId: s.id,
                              expectedSeasonVersion: s.version,
                              featured: !s.featured,
                            })
                          }
                        >
                          {s.featured
                            ? "Remove from featured"
                            : "Feature this season"}
                        </button>
                        <SeasonTemplate key={s.id} season={s} run={run} />
                      </article>
                    ))}
                </div>
              </div>
            </>
          ) : (
            loaded && <p>Administrator permission is required.</p>
          )}
        </>
      )}{" "}
    </>
  );
}
