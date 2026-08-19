import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params;
  const dim = Number(size) === 512 ? 512 : 192;
  const maskable = new URL(request.url).searchParams.has("maskable");
  const scale = maskable ? 0.55 : 0.72;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#10141f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: dim * scale * 0.42,
            fontWeight: 700,
            color: "#ff6a3d",
            display: "flex",
          }}
        >
          BE
        </div>
      </div>
    ),
    { width: dim, height: dim }
  );
}
