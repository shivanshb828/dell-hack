import { Request, Response, NextFunction } from "express";
import twilio from "twilio";
import { config } from "../config";

export function twilioValidate(req: Request, res: Response, next: NextFunction): void {
  if (config.NODE_ENV === "test" || config.DISABLE_TWILIO_SIGNATURE_VALIDATION) {
    next();
    return;
  }

  const signature = req.headers["x-twilio-signature"] as string;
  const url = config.PUBLIC_URL + req.originalUrl;
  const valid = twilio.validateRequest(config.TWILIO_AUTH_TOKEN, signature, url, req.body);

  if (!valid) {
    res.status(403).send("Forbidden");
    return;
  }

  next();
}
