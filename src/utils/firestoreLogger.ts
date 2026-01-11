import { auth } from "@/config/firebase";

interface FsCtx {
  op: string;
  phase?: "start" | "success" | "error";
  meta?: Record<string, any>;
  error?: unknown;
}

const PREFIX = "[FS]";

function normError(err: unknown) {
  if (!err) return undefined;
  if (err instanceof Error) {
    const anyErr = err as Error & { code?: unknown; details?: unknown };
    return {
      message: err.message,
      name: err.name,
      code: anyErr.code,
      stack: err.stack,
      details: anyErr.details,
    };
  }
  if (typeof err === "object" && err !== null)
    return { ...(err as Record<string, unknown>) };
  return { value: String(err) };
}

export function logFs(ctx: FsCtx) {
  const user = auth.currentUser;
  const payload = {
    ts: new Date().toISOString(),
    uid: user?.uid,
    authEmail: user?.email,
    op: ctx.op,
    phase: ctx.phase,
    ...ctx.meta,
    error: normError(ctx.error),
  };
  if (ctx.phase === "error") console.error(PREFIX, payload);
  else console.log(PREFIX, payload);
}

export const logFsStart = (op: string, meta?: Record<string, any>) =>
  logFs({ op, phase: "start", meta });
export const logFsSuccess = (op: string, meta?: Record<string, any>) =>
  logFs({ op, phase: "success", meta });
export const logFsError = (
  op: string,
  error: unknown,
  meta?: Record<string, any>
) => logFs({ op, phase: "error", meta, error });
