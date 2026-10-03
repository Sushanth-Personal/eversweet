import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Eversweet — Click here to confirm your order";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #fffaf2 0%, #fff3dc 52%, #ffe2e8 100%)",
        color: "#40272d",
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 430,
          height: 430,
          right: -80,
          top: -120,
          borderRadius: 999,
          background: "rgba(255, 202, 84, .26)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 330,
          height: 330,
          right: 100,
          bottom: -190,
          borderRadius: 999,
          background: "rgba(237, 94, 119, .16)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          padding: "68px 82px 64px",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 122,
              height: 122,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              borderRadius: 32,
              transform: "rotate(-5deg)",
              background: "linear-gradient(145deg, #ffd45f, #ffbd4a)",
              boxShadow: "0 18px 45px rgba(111, 65, 25, .16)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
              <div style={{ width: 31, height: 31, borderRadius: 99, background: "#ef7188", border: "3px solid #fff3" }} />
              <div style={{ width: 31, height: 31, marginLeft: -4, borderRadius: 99, background: "#f6e4a3", border: "3px solid #fff3" }} />
              <div style={{ width: 31, height: 31, marginLeft: -4, borderRadius: 99, background: "#72a94b", border: "3px solid #fff3" }} />
              <div style={{ width: 39, height: 6, marginLeft: -3, borderRadius: 9, background: "#9d653d" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 57, letterSpacing: 12, lineHeight: 1, color: "#4b2617" }}>EVERSWEET</div>
            <div style={{ marginTop: 13, fontFamily: "Arial, sans-serif", fontSize: 18, letterSpacing: 7, color: "#9b6049" }}>
              HAPPINESS IN ONE BITE
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div style={{ fontFamily: "Arial, sans-serif", color: "#e0526d", fontWeight: 800, fontSize: 23, letterSpacing: 5 }}>
              ORDER CONFIRMATION
            </div>
            <div style={{ marginTop: 17, fontSize: 58, lineHeight: 1.08 }}>
              Choose your box, flavours and delivery time
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 250,
              padding: "23px 31px",
              borderRadius: 999,
              background: "#e95872",
              color: "white",
              fontFamily: "Arial, sans-serif",
              fontSize: 27,
              fontWeight: 900,
              letterSpacing: 2,
              boxShadow: "0 13px 30px rgba(196, 55, 81, .24)",
            }}
          >
            CLICK HERE →
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
