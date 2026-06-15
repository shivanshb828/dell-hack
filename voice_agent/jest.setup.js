// Stub required env vars so config.ts loads cleanly in tests
process.env.TWILIO_ACCOUNT_SID = "ACtest00000000000000000000000000000";
process.env.TWILIO_AUTH_TOKEN = "test_auth_token_stub";
process.env.TWILIO_PHONE_NUMBER = "+15550000000";
process.env.PUBLIC_URL = "https://test.example.com";
process.env.GEMINI_API_KEY = "test_gemini_key_stub";
process.env.NODE_ENV = "test";
process.env.PORT = "3099";
process.env.DONNA_DB_PATH = ":memory:";
process.env.DONNA_DRAFTS_DIR = "/tmp/donna-drafts-test";
