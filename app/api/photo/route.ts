import { NextResponse, type NextRequest } from "next/server";
import { verifyPhotoSig, getPhotoFromDb } from "@/lib/server/photos";

/**
 * Sirve la foto de una prenda guardada en la BD de acmsy.
 * URL: /api/photo?k=<key>&v=<updated_at>&s=<firma HMAC>
 * La firma autoriza el acceso (no requiere cookie), así sirve para <img>,
 * next/image y fetch del lado servidor.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const k = searchParams.get("k") || "";
  const v = searchParams.get("v") || "";
  const s = searchParams.get("s") || "";

  if (!verifyPhotoSig(k, v, s)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const photo = await getPhotoFromDb(k);
  if (!photo) {
    return new NextResponse("not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(photo.data), {
    status: 200,
    headers: {
      "Content-Type": photo.contentType || "image/webp",
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
