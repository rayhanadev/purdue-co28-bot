# Purdue Email Verification Bot

This bot is used to gate the Class of 2028 Discord Server so only folks with
verified Purdue emails can join. It is written in Bun and uses Elysia, discord.js, and HTMX.

## Installation

1. Clone this repository
2. Run `bun install`
3. Create a `.env` file with the following contents:

```
COOKIE_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
PASERK_PUBLIC_KEY=
PASERK_SECRET_KEY=
SENDGRID_API_KEY=
```

4. Run `bun dev`

## Usage

1. Visit the `/` page to get redirected to log in with Discord.
2. Once logged in, you will be be asked to input your Purdue email.
3. You will receive an email with a verification link.
4. Click the verification link to verify your email.
5. You will be redirected back to the Discord server.
