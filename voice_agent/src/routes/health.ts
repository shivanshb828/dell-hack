import { Router, Request, Response } from "express";
import { config } from "../config";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    provider: config.VOICE_PROVIDER,
  });
});
