import dotenv from 'dotenv';
dotenv.config();

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: num(process.env.PORT, 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessTtl: num(process.env.JWT_ACCESS_TTL, 900),
    refreshTtl: num(process.env.JWT_REFRESH_TTL, 604800),
    twoFactorIssuer: process.env.TWO_FACTOR_ISSUER ?? 'LandGuard Kenya',
  },

  payments: {
    sandbox: (process.env.PAYMENTS_SANDBOX ?? 'true') === 'true',
    mpesa: {
      consumerKey: process.env.MPESA_CONSUMER_KEY ?? '',
      consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? '',
      shortcode: process.env.MPESA_SHORTCODE ?? '174379',
      passkey: process.env.MPESA_PASSKEY ?? '',
      callbackUrl: process.env.MPESA_CALLBACK_URL ?? '',
    },
    cardGatewayKey: process.env.CARD_GATEWAY_KEY ?? '',
  },

  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    firebaseBucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
  },

  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',

  ml: {
    enabled: (process.env.ML_ENABLED ?? 'true') === 'true',
    url: process.env.ML_SERVICE_URL ?? 'http://localhost:5001',
    timeoutMs: num(process.env.ML_TIMEOUT_MS, 2500),
  },
};
