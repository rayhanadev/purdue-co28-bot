import { html } from "@elysiajs/html";
import {
	Client,
	GatewayIntentBits,
	ChannelType,
	type TextChannel,
} from "discord.js";
import type {} from "discord.js";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { sign, verify } from "paseto-ts/v4";
import { Resend } from "resend";

import { db } from "./db";
import { type InsertUser, users } from "./db/schema";
import { env } from "./env";

const GUILD_ID = "1220609699691499530";
const VERIFIED_ROLE_ID = "1223804777868296234";
const GENERAL_CHANNEL_ID = "1220609699691499537";
const ANNOUNCEMENTS_CHANNEL_ID = "1220609699691499534";
const INTRODUCTIONS_CHANNEL_ID = "1223813847509499947";
const ROLES_CHANNEL_ID = "1223842237377675384";

const SERVER_WELCOME_MESSAGE = (
	userId: string,
) => `**Welcome to the server <@${userId}>! 👋**

Here are some quick-links for you to help you get around:
- Read up on the latest news in <#${ANNOUNCEMENTS_CHANNEL_ID}>!
- Get your roles in the <#${ROLES_CHANNEL_ID}> channel!
- Introduce yourself in <#${INTRODUCTIONS_CHANNEL_ID}>!
- Meet your fellow classmates here in <#${GENERAL_CHANNEL_ID}>!

(Tip: we suggest changing your username using \`/nick\` so people know who you are!)

We're glad you're here and hope you have a good time! 🎉`;

const bot = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const resend = new Resend(env.RESEND_API_KEY);

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

				const dbUser = await db
					.select()
					.from(users)
					.where(eq(users.email, email));

				if (dbUser.length > 0) {
					set.status = 400;
					return '<p id="result">You have already been verified! Please contact me@rayhanadev.com if you think is a mistake.</p>';
				}

				const token = sign(env.PASERK_SECRET_KEY, {
					id: user.id,
					email,
				});

				const url = `${env.DISCORD_REDIRECT_URI}/verify/callback?token=${token}`;

				const response = await resend.emails.send({
					from: "Ray <verify@mail.rayhanadev.com>",
					to: [email],
					subject: "Verify your Email Address",
					html: `Click <a href="${url}">this</a> link to verify your email address for the Purdue Class of 2028 Discord Server.<br /><br />If you did not request this, please ignore this email.<br /><br />If the link does not work, copy and paste the following URL into your browser: ${url}`,
					tags: [
						{
							name: "category",
							value: "confirm_email",
						},
					],
				});

				if (response.error) {
					return `<p id="result">‼️ An error occurred while sending the verification email. Please contact me@rayhanadev.com for support.</p>`;
				}

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

				const { id, email } = payload;

				const dbUser = await db
					.select()
					.from(users)
					.where(eq(users.email, email));

				if (dbUser.length > 0) {
					set.status = 400;
					return '<p id="result">‼️ This email is already in use. Please contact me@rayhanadev.com if this is a mistake.</p>';
				}

				const isInServer = await bot.guilds
					.fetch(GUILD_ID)
					.then(async (guild) => {
						return guild.members
							.fetch(id)
							.then((member) => {
								if (member) {
									return true;
								}

								return false;
							})
							.catch((error) => {
								console.error(error);
								return false;
							});
					});

				if (!isInServer) {
					return '<p id="result">‼️ You must be a member of the Purdue Class of 2028 Discord server to verify your email.</p>';
				}

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
							(channel as TextChannel).send(SERVER_WELCOME_MESSAGE(id));
							return channel;
						}
						return null;
					});
				});

				await db.insert(users).values({
					id: id,
					email: email,
					name: response.user.username,
				} satisfies InsertUser);

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
