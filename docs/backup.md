# Backing up your collection

Your collection is two things on disk: one SQLite database and a folder of
uploaded covers. Both must travel together, and the database needs a little
more care than a file copy.

## Why not just copy the file

The database runs in WAL mode. Recent writes live in a `comic-shelf.db-wal`
file next to the database, and only move into the `.db` file when SQLite
decides to checkpoint. How much sits on which side depends on when you look.

On a freshly created database the split can be total:

| File | Size |
| --- | --- |
| `collectie.db` | 4 KB, no tables at all |
| `collectie.db-wal` | 78 KB, the entire schema |

Copying the `.db` file alone there gives you a database with **zero tables**.
It opens without complaint, which is the dangerous part: you find out when you
try to restore.

## Making a backup

```bash
npm run db:backup
```

This writes a timestamped folder under `backups/`, containing the database and
a copy of the covers. It uses SQLite's online backup API, so it is safe to run
while the app is serving requests, and it does three things a copy does not:

- folds the WAL into the database, so the result is one self-contained file
- switches the copy out of WAL mode, so there is no `-wal` file to forget
- opens the finished backup and counts the rows, so an empty backup fails loudly

Output looks like this:

```
Backup written to /…/backups/2026-10-08_182059
  database  0.06 MB
    series    14
    albums    20
    editions  20
    copies    19
  covers    19 files, 0.03 MB
```

If the row counts look wrong, stop and investigate before you overwrite
anything.

### Where it reads from and writes to

The script follows the same environment variables as the app, so it backs up
whichever database the app is actually using:

| Variable | Default |
| --- | --- |
| `DATABASE_PATH` | `./data/comic-shelf.db` |
| `COVERS_DIR` | `data/covers` |
| `BACKUP_DIR` | `./backups` |

### Keeping the folder from growing

By default every backup is kept. On a schedule you usually want a ceiling:

```bash
npm run db:backup -- --keep 14
```

That deletes all but the newest fourteen. It only ever removes folders it
created itself, matched on the timestamp pattern.

### On a schedule

A daily backup at 03:00, writing somewhere outside the application folder:

```
0 3 * * * cd /path/to/comic-shelf && BACKUP_DIR=/path/to/backups npm run db:backup -- --keep 30
```

Put the destination on a different disk than the live database. A backup that
dies with the disk it was protecting is not a backup.

## Restoring

1. Stop the app.
2. Copy the database from the backup folder over `DATABASE_PATH`.
3. Delete any `-wal` and `-shm` files sitting next to the live database. They
   belong to the database you are replacing, and leaving them behind corrupts
   the restore.
4. Copy the backup's `covers` folder over `COVERS_DIR`.
5. Start the app.

```bash
# with the app stopped, and paths adjusted to your own
cp backups/2026-10-08_182059/comic-shelf.db  data/comic-shelf.db
rm -f data/comic-shelf.db-wal data/comic-shelf.db-shm
cp -R backups/2026-10-08_182059/covers/.     data/covers/
```

Migrations run on the next start, so a backup from an older version of the app
is brought up to date automatically.

## Test the restore once

An untested backup is a guess. Once, before you have anything to lose, restore
into a scratch location and open it:

```bash
DATABASE_PATH=/tmp/restore-test/comic-shelf.db \
COVERS_DIR=/tmp/restore-test/covers \
npm start
```

Copy a backup into that folder first. If the shelf shows your albums with their
covers, the procedure works. Do this before your collection is large enough to
hurt.
