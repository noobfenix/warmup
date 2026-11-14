import { NextResponse } from "next/server";
import { getCorsHeaders } from "../../../lib/security";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req, "GET, OPTIONS"),
  });
}

export async function GET(req: Request) {
  const corsHeaders = getCorsHeaders(req, "GET, OPTIONS");
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "promptwars-warmup",
      uptime: process.uptime(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        ...corsHeaders,
      },
    }
  );
}
