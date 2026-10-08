# Comic Shelf

A small, self-hosted app for cataloguing a personal comic collection, with a
soft spot for Belgian and Dutch albums: Suske en Wiske, Blake en Mortimer,
Jommeke, Kiekeboe.

It is deliberately small. One SQLite file, no accounts, no external services.
You can clone it and have it running in under a minute.

## What it does today

- Add an album with series, number, publisher, year, ISBN and a cover image
- Browse your shelf, cover-first
- Search across series, title, publisher and ISBN
- Open an album, edit every field, replace the cover, or delete it

See the [roadmap](#roadmap) for what comes next.

## Stack

| Layer     | Choice                                  | Why                                                     |
| --------- | --------------------------------------- | ------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Server Actions) | One codebase for UI and mutations, no separate API      |
| Database  | SQLite via better-sqlite3 + Drizzle ORM | Zero setup, a single file to back up, typed queries     |
| Styling   | Tailwind CSS 4                          | Fast to iterate, dark mode for free                     |
| Tests     | Vitest                                  | Domain logic runs against an in-memory SQLite database  |

## Running it

Requirements: Node.js 22 or newer.

```bash
git clone https://github.com/yannickdesiron/comic-shelf.git
cd comic-shelf
npm install
npm run dev
```

Open http://localhost:3000. The database is created on first start at
`data/comic-shelf.db` and migrations are applied automatically. Uploaded
covers land in `data/covers/`. Both are ignored by git.

Copy `.env.example` to `.env` if you want to change those paths.

## Development

```bash
npm run db:seed     # fill an empty database with 18 classic albums and generated covers
npm test            # unit tests (Vitest)
npm run lint        # ESLint
npm run typecheck   # Next.js route types + tsc
npm run db:generate # generate a migration after changing src/db/schema.ts
npm run db:studio   # browse the database in Drizzle Studio
```

All four checks run in CI on every push and pull request.

## Domain model

```
series  1 ─── n  albums  1 ─── n  editions  1 ─── n  copies
```

- A **series** is a comic series ("Suske en Wiske").
- An **album** is one story in that series, usually numbered.
- An **edition** is a specific printing: publisher, year, ISBN, cover.
- A **copy** is what you actually own: physical or digital, where it lives, whether you have read it.

Four tables is enough to model reprints and duplicate copies without
getting in the way of adding your first album.

## Project layout

```
src/
  app/                 routes, server actions, layout
    albums/            shared album form and server actions (create, update, delete)
    albums/new/        add an album
    albums/[slug]/     album detail page, with edit/ below it
    covers/[file]/     serves uploaded cover images
  components/          shared UI
  db/                  Drizzle schema and SQLite client (runs migrations)
  lib/                 domain logic and helpers, with tests next to them
scripts/               seed script
drizzle/               generated SQL migrations
data/                  local database and covers (git-ignored)
```

## Roadmap

Tracked as [GitHub issues](https://github.com/yannickdesiron/comic-shelf/issues) under the
[v0.2 milestone](https://github.com/yannickdesiron/comic-shelf/milestone/1). Rough order:

1. ~~Album detail page, edit and delete~~ (#1)
2. Read status toggle from the shelf (#2)
3. Filters: language, format, read status (#3)
4. ISBN lookup to prefill metadata (#4)
5. Barcode scanning on mobile (#5)
6. Dutch and English UI toggle (#6)

## License

MIT
