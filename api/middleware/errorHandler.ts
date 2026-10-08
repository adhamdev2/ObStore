import { Request, Response, NextFunction } from "express";

export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.error(`[Error Handler] ${req.method} ${req.url} ->`, err?.message || err);

    if (err.name === "ZodError") {
        return res.status(400).json({
            error: "Validation failed",
            details: err.errors
        });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({ error: message });
}
