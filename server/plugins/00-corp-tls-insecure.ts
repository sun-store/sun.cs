/**
 * Firmowy SSL intercept (self-signed w łańcuchu do googleapis) — tylko lokalnie.
 * CORP_TLS_INSECURE=1 w .env; na Vercel (VERCEL=1) ignorowane.
 */
export default defineNitroPlugin(() => {
  if (process.env.VERCEL === '1') return
  if (process.env.CORP_TLS_INSECURE !== '1' && process.env.BQ_TLS_INSECURE !== '1') return
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
})
