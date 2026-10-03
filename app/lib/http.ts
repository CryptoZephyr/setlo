import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./chains";

export function handler(fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return NextResponse.json(await fn(req, ctx), { headers: { "cache-control": "no-store" } });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "invalid request", issues: e.issues }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
  };
}

/** JSON body parser that turns malformed JSON into a 400 instead of a 500. */
export async function json(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "invalid JSON");
  }
}
