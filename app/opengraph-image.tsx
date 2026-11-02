import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Ryno operations workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const icon = await readFile(join(process.cwd(), "app/icon.png"));
  const iconUrl = `data:image/png;base64,${icon.toString("base64")}`;
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#141714",
        color: "#fff",
        padding: "64px 72px",
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* The icon is embedded so the image renderer does not need a network request. */}
          <img
            src={iconUrl}
            width={58}
            height={58}
            alt=""
            style={{ borderRadius: 16 }}
          />
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1 }}>
            ryno
          </span>
          <span style={{ fontSize: 18, color: "#a5ada5", marginLeft: 10 }}>
            OPERATIONS
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              display: "flex",
              color: "#ff7443",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 3,
              marginBottom: 20,
            }}
          >
            THE RYNO WORKSPACE
          </span>
          <span
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1.06,
            }}
          >
            Your operations,
          </span>
          <span
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1.06,
            }}
          >
            all in one place.
          </span>
          <span
            style={{
              display: "flex",
              color: "#b7beb7",
              fontSize: 25,
              marginTop: 24,
            }}
          >
            Orders · Partners · Reports · Payments
          </span>
        </div>
        <span style={{ display: "flex", color: "#868e86", fontSize: 18 }}>
          Ryno mobility
        </span>
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: -150,
          top: 90,
          width: 510,
          height: 510,
          borderRadius: 255,
          border: "75px solid #fa531b",
          opacity: 0.16,
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 75,
          top: 225,
          width: 150,
          height: 150,
          borderRadius: 75,
          background: "#ff5a1f",
          opacity: 0.9,
        }}
      />
    </div>,
    size,
  );
}
