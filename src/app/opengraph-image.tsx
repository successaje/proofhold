import { ImageResponse } from "next/og";

export const alt =
  "Proofhold: a PayPal payment that is held until the agreed proof arrives";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview. Drawn from the same mark and seal geometry as the app. */
export default function Image() {
  const segments = ["#1d6f47", "#1d6f47", "#1d6f47", "#9a6a12"];
  const arcs = segments.map((color, i) => {
    const n = segments.length;
    const gap = 8;
    const start = -90 + (i * 360) / n + gap / 2;
    const end = start + 360 / n - gap;
    const p = (a: number) => [
      100 + 78 * Math.cos((a * Math.PI) / 180),
      100 + 78 * Math.sin((a * Math.PI) / 180),
    ];
    const [x1, y1] = p(start);
    const [x2, y2] = p(end);
    return (
      <path
        key={i}
        d={`M${x1} ${y1}A78 78 0 0 1 ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
      />
    );
  });
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#f6f4ef",
        color: "#17150f",
        padding: 72,
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 64 64">
            <path
              d="M52.8 20A24 24 0 1 1 44 11.2"
              fill="none"
              stroke="#0d5c4e"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M21 33l8 8 26-28"
              fill="none"
              stroke="#0d5c4e"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ fontSize: 40, letterSpacing: -1 }}>Proofhold</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 680 }}>
          <div style={{ fontSize: 58, lineHeight: 1.08, letterSpacing: -1.5 }}>
            A PayPal payment that is held until the agreed proof arrives.
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#4b4740",
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            A test both sides approve. PayPal holds the money. Checks decide.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <svg width="300" height="300" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r="92"
            fill="#ffffff"
            stroke="#e1ddd4"
            strokeWidth="1"
          />
          {arcs}
          <text
            x="100"
            y="108"
            textAnchor="middle"
            fontSize="34"
            fontFamily="Georgia, serif"
            fill="#17150f"
          >
            $420.00
          </text>
          <text
            x="100"
            y="132"
            textAnchor="middle"
            fontSize="10"
            fontFamily="Courier, monospace"
            fill="#76716a"
            letterSpacing="2"
          >
            HELD BY PAYPAL
          </text>
        </svg>
      </div>
    </div>,
    size,
  );
}
