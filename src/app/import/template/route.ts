import { buildTemplate } from "@/lib/import";

export function GET() {
  return new Response(new Uint8Array(buildTemplate()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="comic-shelf-sjabloon.xlsx"',
    },
  });
}
