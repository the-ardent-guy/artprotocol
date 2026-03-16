import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").trim();
const API_KEY = (process.env.BACKEND_API_KEY || "").trim();

async function proxy(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/");
  const search = req.nextUrl.search;
  const url = `${BACKEND_URL}/${path}${search}`;

  const headers = new Headers(req.headers);
  headers.set("x-api-key", API_KEY);
  // Remove headers that cause issues when forwarding
  headers.delete("host");

  const body =
    req.method !== "GET" && req.method !== "HEAD"
      ? await req.arrayBuffer()
      : undefined;

  const res = await fetch(url, {
    method: req.method,
    headers,
    body: body ? Buffer.from(body) : undefined,
    // @ts-ignore - Node 18+ duplex requirement
    duplex: "half",
  });

  const resHeaders = new Headers(res.headers);
  // Allow SSE streams to pass through
  return new NextResponse(res.body, {
    status: res.status,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
