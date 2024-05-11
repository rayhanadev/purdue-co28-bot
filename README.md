# Purdue Email Verification Bot

This bot is used to gate the Class of 2028 Discord Server so only folks with
verified Purdue emails can join. It is written in Bun and uses Elysia, discord.js, and HTMX.

## Installation

1. Clone this repository
2. Run `bun install` to install all dependencies.
3. Run `turso db create [dbname]` to create a new database.
4. Run `turso db tokens create [dbname]` to create a new database token.
5. Run `turso db show [dbname]` to get the database URL.
6. Run `bun gen:paserk` to generate a new Paserk keypair.
7. Create a `.env` file with the following contents:

```
COOKIE_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
PASERK_PUBLIC_KEY=
PASERK_SECRET_KEY=
RESEND_API_KEY=
TURSO_AUTH_TOKEN=
TURSO_CONNECTION_URL=
```

8. Run `bun db:migrate` to run all migrations upwards.
9. Run `bun dev` to start the server.

## Usage

1. Visit the `/` page to get redirected to log in with Discord.
2. Once logged in, you will be be asked to input your Purdue email.
3. You will receive an email with a verification link.
4. Click the verification link to verify your email.
5. You will be redirected back to the Discord server.
