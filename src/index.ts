import { html } from "@elysiajs/html";
import sendgrid from "@sendgrid/mail";
import { Client, GatewayIntentBits, ChannelType } from "discord.js";
import type { TextChannel } from "discord.js";
import { Elysia, t } from "elysia";
import { sign, verify } from "paseto-ts/v4";

import { env } from "./env";

const GUILD_ID = "1220609699691499530";
const VERIFIED_ROLE_ID = "1223804777868296234";
const GENERAL_CHANNEL_ID = "1220609699691499537";

const bot = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

sendgrid.setApiKey(env.SENDGRID_API_KEY);

const app = new Elysia({
	cookie: {
		secrets: [env.COOKIE_SECRET],
		sign: ["session"],
	},
});

app.use(html());

app.get("/", async ({ set, cookie }) => {
	const session = cookie.session.value;

	if (!session) {
		set.redirect = "/oauth/discord";
		return;
	}

	const file = Bun.file(`${process.cwd()}/src/views/index.html`);
	const content = await file.text();

	return content;
});

app.group("/verify", (app) =>
	app
		.post(
			"/",
			async ({ set, cookie, body }) => {
				const session = cookie.session.value;

				if (!session) {
					return '<p id="result">Unauthorized</p>';
				}

				const user = (await fetch("https://discord.com/api/users/@me", {
					headers: {
						Authorization: `${session.token_type} ${session.access_token}`,
					},
				}).then((res) => res.json())) as { id: string };

				if (!user.id) {
					set.status = 403;
					cookie.session.expires = new Date(0);
					return '<p id="result">Unauthorized</p>';
				}

				const { email } = body;

				if (!email.endsWith("@purdue.edu")) {
					set.status = 400;
					return '<p id="result">‼️ Invalid email address, please use your official @purdue.edu email.</p>';
				}

				const token = sign(env.PASERK_SECRET_KEY, {
					id: user.id,
					email,
				});

				const url = `${env.DISCORD_REDIRECT_URI}/verify/callback?token=${token}`;

				const msg = {
					to: email,
					from: "em5024@furret.dev",
					subject: "Verification for Purdue Class of 2028 Discord Server",
					html: `Click <a href="${url}">this</a> link to verify your Purdue email for the Purdue Class of 2028 Discord Server.<br /><br />If you did not request this, please ignore this email.<br /><br />If the link does not work, copy and paste the following URL into your browser: ${url}`,
				};

				sendgrid.send(msg);

				return '<p id="result">✅ Please check your email for a verification request!</p>';
			},
			{
				body: t.Object({
					email: t.String(),
				}),
				cookie: t.Cookie({
					session: t.Object({
						token_type: t.String({ default: "Bearer" }),
						access_token: t.String(),
						expires_in: t.Number(),
						refresh_token: t.String(),
						scope: t.String(),
					}),
				}),
			},
		)
		.get(
			"/callback",
			async ({ set, query }) => {
				const { token } = query;

				if (!token) {
					set.status = 403;
					return '<p id="result">Unauthorized</p>';
				}

				const { payload } = verify(env.PASERK_PUBLIC_KEY, token);

				const { id } = payload;

				const hasRole = await bot.guilds.fetch(GUILD_ID).then(async (guild) => {
					return guild.members
						.fetch(id)
						.then((member) => {
							if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
								return true;
							}

							return false;
						})
						.catch((error) => {
							console.error(error);
							return false;
						});
				});

				if (hasRole) {
					return '<p id="result">You have been authorized. You may return to the Purdue Class of 2028 Discord Server.</p>';
				}

				const response = await bot.guilds
					.fetch(GUILD_ID)
					.then(async (guild) => {
						return guild.members
							.fetch(id)
							.then((member) => {
								member.roles.add(VERIFIED_ROLE_ID);
								return member;
							})
							.catch((error) => {
								console.error(error);
								return null;
							});
					});

				if (!response) {
					set.status = 500;
					return '<p id="result">Internal Server Error</p>';
				}

				await bot.guilds.fetch(GUILD_ID).then(async (guild) => {
					return guild.channels.fetch(GENERAL_CHANNEL_ID).then((channel) => {
						if (channel && channel.type === ChannelType.GuildText) {
							(channel as TextChannel).send(
								`Welcome to the server <@${id}>! 👋`,
							);
							return channel;
						}
						return null;
					});
				});

				return '<p id="result">You have been authorized. You may return to the Purdue Class of 2028 Discord Server.</p>';
			},
			{
				query: t.Object({
					token: t.String(),
				}),
			},
		),
);

app.group("/api", (app) =>
	app.get(
		"/user",
		async ({ set, cookie }) => {
			const session = cookie.session.value;

			const user = (await fetch("https://discord.com/api/users/@me", {
				headers: {
					Authorization: `${session.token_type} ${session.access_token}`,
				},
			}).then((res) => res.json())) as { id: string };

			if (!user.id) {
				set.status = 403;
				cookie.session.expires = new Date(0);
				return '<p id="result">Unauthorized</p>';
			}

			return user;
		},
		{
			cookie: t.Cookie({
				session: t.Object({
					token_type: t.String({ default: "Bearer" }),
					access_token: t.String(),
					expires_in: t.Number(),
					refresh_token: t.String(),
					scope: t.String(),
				}),
			}),
		},
	),
);

app.group("/oauth/discord", (app) =>
	app
		.get("/", async ({ set }) => {
			const endpoint = new URL("https://discord.com/api/oauth2/authorize");

			const params = new URLSearchParams({
				client_id: env.DISCORD_CLIENT_ID,
				redirect_uri: `${env.DISCORD_REDIRECT_URI}/oauth/discord/callback`,
				response_type: "code",
				scope: "identify email",
			});

			endpoint.search = params.toString();

			set.redirect = endpoint.toString();
		})
		.get(
			"/callback",
			async ({ query, cookie, set }) => {
				const { code } = query;

				if (!code) {
					set.status = 400;
					return '<p id="result">Invalid code</p>';
				}

				type ErrorResponse = {
					error: string;
					error_description: string;
				};

				type SuccessResponse = {
					access_token: string;
					token_type: string;
					expires_in: number;
					refresh_token: string;
					scope: string;
				};

				const response = (await fetch("https://discord.com/api/oauth2/token", {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: new URLSearchParams({
						client_id: env.DISCORD_CLIENT_ID,
						client_secret: env.DISCORD_CLIENT_SECRET,
						grant_type: "authorization_code",
						code,
						redirect_uri: `${env.DISCORD_REDIRECT_URI}/oauth/discord/callback`,
					}),
				}).then((res) => res.json())) as ErrorResponse & SuccessResponse;

				if (response.error) {
					return response.error_description;
				}

				cookie.session.value = response;

				set.redirect = "/";
			},
			{
				query: t.Object({
					code: t.String(),
				}),
				cookie: t.Cookie({
					session: t.Object({
						token_type: t.String({ default: "Bearer" }),
						access_token: t.String(),
						expires_in: t.Number(),
						refresh_token: t.String(),
						scope: t.String(),
					}),
				}),
			},
		),
);

app.listen(3000);
bot.login(env.DISCORD_BOT_TOKEN);
console.log("BoilerBot running on port 3000.");
