import twilio from "twilio";
import { config } from "../../config";

export async function autoRegisterTwilioWebhook(): Promise<void> {
  if (!config.PUBLIC_URL) {
    console.warn("[twilio] PUBLIC_URL not set — skipping webhook auto-registration");
    return;
  }

  const targetUrl = `${config.PUBLIC_URL}/voice`;
  const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

  try {
    let sid = config.TWILIO_PHONE_NUMBER_SID;

    // If SID not provided, look it up by phone number
    if (!sid) {
      const numbers = await client.incomingPhoneNumbers.list({
        phoneNumber: config.TWILIO_PHONE_NUMBER,
        limit: 1,
      });
      if (!numbers.length) {
        console.warn("[twilio] Phone number not found in account — skipping webhook registration");
        return;
      }
      sid = numbers[0].sid;
    }

    const number = await client.incomingPhoneNumbers(sid).fetch();

    if (number.voiceUrl === targetUrl) {
      console.log(`[twilio] Webhook already set: ${targetUrl}`);
      return;
    }

    await client.incomingPhoneNumbers(sid).update({
      voiceUrl: targetUrl,
      voiceMethod: "POST",
    });
    console.log(`[twilio] Webhook registered: ${targetUrl}`);
  } catch (err) {
    // Non-fatal — manual webhook setup can be done in Twilio console
    console.warn("[twilio] Webhook auto-registration failed:", err instanceof Error ? err.message : err);
  }
}
