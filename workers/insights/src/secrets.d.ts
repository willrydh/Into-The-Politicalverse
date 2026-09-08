// Values exist only as Cloudflare encrypted secrets, never in the static export.
interface Env { ADMIN_PASSWORD_HASH: string; SESSION_SECRET: string; }
