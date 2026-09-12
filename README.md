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

That is the whole v0.1. See the [roadmap](#roadmap) for what comes next.

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
    albums/new/        add-album form and its server action
    covers/[file]/     serves uploaded cover images
  components/          shared UI
  db/                  Drizzle schema and SQLite client (runs migrations)
  lib/                 domain logic and helpers, with tests next to them
drizzle/               generated SQL migrations
data/                  local database and covers (git-ignored)
```

## Roadmap

Tracked as GitHub issues. Rough order:

1. Album detail page, edit and delete
2. Read status toggle from the shelf
3. Filters: language, format, read status
4. ISBN lookup to prefill metadata
5. Barcode scanning on mobile
6. Dutch and English UI toggle

## License

MIT
