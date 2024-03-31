import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		NODE_ENV: z.enum(["development", "production"]).default("development"),
		COOKIE_SECRET: z.string(),
		DISCORD_BOT_TOKEN: z.string(),
		DISCORD_CLIENT_ID: z.string(),
		DISCORD_CLIENT_SECRET: z.string(),
		DISCORD_REDIRECT_URI: z.string(),
		PASERK_PUBLIC_KEY: z.string(),
		PASERK_SECRET_KEY: z.string(),
		SENDGRID_API_KEY: z.string(),
		TURSO_AUTH_TOKEN: z.string(),
		TURSO_CONNECTION_URL: z.string(),
	},
	runtimeEnv: {
		NODE_ENV: Bun.env.NODE_ENV,
		COOKIE_SECRET: Bun.env.COOKIE_SECRET,
		DISCORD_BOT_TOKEN: Bun.env.DISCORD_BOT_TOKEN,
		DISCORD_CLIENT_ID: Bun.env.DISCORD_CLIENT_ID,
		DISCORD_CLIENT_SECRET: Bun.env.DISCORD_CLIENT_SECRET,
		DISCORD_REDIRECT_URI: Bun.env.DISCORD_REDIRECT_URI,
		PASERK_PUBLIC_KEY: Bun.env.PASERK_PUBLIC_KEY,
		PASERK_SECRET_KEY: Bun.env.PASERK_SECRET_KEY,
		SENDGRID_API_KEY: Bun.env.SENDGRID_API_KEY,
		TURSO_AUTH_TOKEN: Bun.env.TURSO_AUTH_TOKEN,
		TURSO_CONNECTION_URL: Bun.env.TURSO_CONNECTION_URL,
	},
});
