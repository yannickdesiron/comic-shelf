/**
 * Fills the local database with a handful of well-known Belgian and Dutch
 * albums so the shelf has something to show, including a few wanted ones. Generates a simple two-tone
 * cover per album. Safe to run repeatedly: it skips when albums exist.
 *
 *   npm run db:seed
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import zlib from "node:zlib";

import { createDb } from "@/db/client";
import { createAlbum, listAlbums, newAlbumSchema, type NewAlbumInput } from "@/lib/albums";
import { coverPath, coversDir } from "@/lib/storage";

type Seed = NewAlbumInput & { palette: [string, string] };

const seeds: Seed[] = [
  { seriesTitle: "Suske en Wiske", number: "67", title: "De Texasrakkers", publisher: "Standaard Uitgeverij", year: "1966", readStatus: "read", location: "Kast woonkamer, plank 1", palette: ["#d85d25", "#fff0d5"] },
  { seriesTitle: "Suske en Wiske", number: "68", title: "De Speelgoedzaaier", publisher: "Standaard Uitgeverij", year: "1966", readStatus: "read", location: "Kast woonkamer, plank 1", palette: ["#2d5fa4", "#f6f0df"] },
  { seriesTitle: "Suske en Wiske", number: "140", title: "De Zwarte Madam", publisher: "Standaard Uitgeverij", year: "1973", readStatus: "read", owned: "no", palette: ["#251c19", "#efe5cf"] },
  { seriesTitle: "Blake en Mortimer", number: "6", title: "Het Gele Teken", publisher: "Lombard", year: "1956", format: "hardcover", readStatus: "read", location: "Kast bureau", palette: ["#d9b557", "#231914"] },
  { seriesTitle: "Blake en Mortimer", number: "9", title: "De Valstrik", publisher: "Lombard", year: "1962", format: "hardcover", readStatus: "reading", location: "Nachtkastje", palette: ["#7d3630", "#f7ecd9"] },
  { seriesTitle: "Kuifje", title: "De Blauwe Lotus", publisher: "Casterman", year: "1946", format: "hardcover", readStatus: "read", location: "Kast bureau", palette: ["#2f716d", "#eef5ef"] },
  { seriesTitle: "Kuifje", title: "Raket naar de Maan", publisher: "Casterman", year: "1953", format: "hardcover", readStatus: "read", location: "Kast bureau", palette: ["#e0e4ea", "#b3261e"] },
  { seriesTitle: "Kuifje", title: "De Zaak Zonnebloem", publisher: "Casterman", year: "1956", format: "hardcover", readStatus: "unread", owned: "no", palette: ["#c7a26b", "#1f1a17"] },
  { seriesTitle: "Jommeke", number: "1", title: "De Jacht op een Voetbal", publisher: "Het Volk", year: "1959", readStatus: "read", location: "Kinderkamer", palette: ["#f0c46f", "#2f1711"] },
  { seriesTitle: "De Kiekeboes", number: "1", title: "De Wollebollen", publisher: "Standaard Uitgeverij", year: "1977", readStatus: "read", location: "Kast woonkamer, plank 2", palette: ["#9d3f1c", "#fff0d5"] },
  { seriesTitle: "De Rode Ridder", number: "1", title: "Het Gebroken Zwaard", publisher: "Standaard Uitgeverij", year: "1959", readStatus: "unread", location: "Kast woonkamer, plank 2", palette: ["#a11f1f", "#f1e4c9"] },
  { seriesTitle: "Robbedoes en Kwabbernoot", number: "15", title: "Z als Zorglub", publisher: "Dupuis", year: "1961", readStatus: "read", location: "Kast woonkamer, plank 2", palette: ["#3b2e7e", "#f4d35e"] },
  { seriesTitle: "Thorgal", number: "1", title: "De Tovenares Verraden", publisher: "Lombard", year: "1980", format: "hardcover", readStatus: "reading", location: "Nachtkastje", palette: ["#1b3a4b", "#c9d6df"] },
  { seriesTitle: "Storm", number: "1", title: "De Diepe Wereld", publisher: "Oberon", year: "1978", readStatus: "unread", location: "Doos zolder", palette: ["#0f5c5a", "#f5b942"] },
  { seriesTitle: "Agent 327", number: "1", title: "Dossier Stemkwadrater", publisher: "Oberon", year: "1978", readStatus: "read", location: "Doos zolder", palette: ["#333333", "#ff8c42"] },
  { seriesTitle: "Franka", number: "1", title: "Het Misdaadmuseum", publisher: "Oberon", year: "1978", readStatus: "unread", owned: "no", palette: ["#b23a48", "#fcf6f5"] },
  { seriesTitle: "Lucky Luke", title: "Dalton City", publisher: "Dupuis", year: "1969", readStatus: "read", location: "Kast woonkamer, plank 3", palette: ["#e8b04b", "#3a2a14"] },
  { seriesTitle: "Guust", number: "1", title: "Flater op los", publisher: "Dupuis", year: "1960", readStatus: "read", location: "Kast woonkamer, plank 3", palette: ["#3f7d3a", "#f3efe0"] },
];

async function main() {
  const db = createDb(process.env.DATABASE_PATH ?? "./data/comic-shelf.db");
  if (listAlbums(db).length > 0) {
    console.log("Database already has albums, nothing to do.");
    return;
  }

  await fs.mkdir(coversDir(), { recursive: true });
  for (const { palette, ...input } of seeds) {
    const coverFile = `${crypto.randomUUID()}.png`;
    await fs.writeFile(coverPath(coverFile), coverPng(palette[0], palette[1]));
    const { slug } = createAlbum(db, { ...newAlbumSchema.parse(input), coverFile });
    console.log(`+ ${slug}`);
  }
  console.log(`Seeded ${seeds.length} albums.`);
}

/** A 300x400 PNG: solid colour with a lighter band at the bottom, like a cheap album spine. */
function coverPng(bg: string, band: string): Buffer {
  const W = 300;
  const H = 400;
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [b, f] = [rgb(bg), rgb(band)];
  const rows: Buffer[] = [];
  for (let y = 0; y < H; y++) {
    const colour = y < 310 || y >= 390 ? b : y < 318 ? f.map((c, i) => Math.round((c + b[i]) / 2)) : f;
    rows.push(Buffer.concat([Buffer.from([0]), Buffer.from(Array(W).fill(colour).flat())]));
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
