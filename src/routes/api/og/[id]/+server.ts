import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import { error } from "@sveltejs/kit";
import satori from "satori";
import { getCounter } from "$lib/server/counters";
import { counterIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

const WIDTH = 1200;
const HEIGHT = 630;

const require = createRequire(import.meta.url);

let fontData: ArrayBuffer | null = null;
let fontBoldData: ArrayBuffer | null = null;

function loadFont(): ArrayBuffer {
  if (fontData) return fontData;
  const fontPath =
    require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff");
  const buf = readFileSync(fontPath);
  fontData = new Uint8Array(buf).buffer as ArrayBuffer;
  return fontData;
}

function loadBoldFont(): ArrayBuffer {
  if (fontBoldData) return fontBoldData;
  const fontPath =
    require.resolve("@fontsource/inter/files/inter-latin-700-normal.woff");
  const buf = readFileSync(fontPath);
  fontBoldData = new Uint8Array(buf).buffer as ArrayBuffer;
  return fontBoldData;
}

function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

export const GET: RequestHandler = async ({ params }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const counter = await getCounter(params.id);
  if (!counter) {
    throw error(404, "Counter not found");
  }

  if (counter.visibilityMode === "private") {
    throw error(404, "Counter not found");
  }

  const font = loadFont();
  const fontBold = loadBoldFont();

  const formattedCount = formatCount(counter.count);
  const title =
    counter.title.length > 60
      ? `${counter.title.slice(0, 57)}...`
      : counter.title;
  const description = counter.description
    ? counter.description.length > 100
      ? `${counter.description.slice(0, 97)}...`
      : counter.description
    : null;

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)",
          fontFamily: "Inter",
          padding: "60px",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "24px",
                      fontWeight: 700,
                      color: "#4f46e5",
                      letterSpacing: "-0.02em",
                    },
                    children: "Count Collab",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "36px",
                      fontWeight: 700,
                      color: "#1e293b",
                      textAlign: "center",
                      maxWidth: "900px",
                      lineClamp: 2,
                    },
                    children: title,
                  },
                },
                ...(description
                  ? [
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "20px",
                            color: "#64748b",
                            textAlign: "center",
                            maxWidth: "800px",
                            marginTop: "4px",
                          },
                          children: description,
                        },
                      },
                    ]
                  : []),
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "160px",
                      fontWeight: 700,
                      color: "#2563eb",
                      lineHeight: 1,
                      marginTop: "24px",
                      letterSpacing: "-0.04em",
                    },
                    children: formattedCount,
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Inter", data: font, weight: 400, style: "normal" as const },
        {
          name: "Inter",
          data: fontBold,
          weight: 700,
          style: "normal" as const,
        },
      ],
    },
  );

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
  });
  const png = resvg.render().asPng();

  return new Response(png as unknown as Blob, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
};
