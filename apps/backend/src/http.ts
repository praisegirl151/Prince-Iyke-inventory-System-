import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, "Route not found", "NOT_FOUND"));
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  void next;
  if (error instanceof ZodError) {
    res.status(400).json({ error: "VALIDATION_ERROR", issues: error.issues });
    return;
  }
  if (error instanceof HttpError) {
    console.error(error.message);
    res
      .status(error.status)
      .json({ error: error.code, message: error.message });
    return;
  }
  res
    .status(500)
    .json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
}

export function jsonSafe(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
}
