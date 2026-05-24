import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { db } from "../db/index.ts";
import { emailOTP } from "better-auth/plugins";
import * as authSchema from "../db/schema/auth-schema.ts";
import { sendOtpEmail, sendWelcomeMessage } from "./email";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
    database: drizzleAdapter(db, {
        provider: "mysql",
        schema: {
            user: authSchema.user,
            session: authSchema.session,
            account: authSchema.account,
            verification: authSchema.verification,
        },
    }),
    plugins: [
        emailOTP({
            allowedAttempts: 5,
            expiresIn: 60 * 5, // 5minutes
            async sendVerificationOTP({ email, otp, type }) {
                if(type === "sign-in"){
                    sendOtpEmail({ email, otp, type });
                }
            },
        }), 
    ],
    hooks: {
        after: createAuthMiddleware(async (ctx) => {
            if(ctx.path.startsWith("/sign-in")){
                const user = ctx.context.newSession?.user;
                if(user){
                    sendWelcomeMessage({
                        to: user?.email,
                        type: "user-register",
                        name: user?.email,
                    })
                }
            }
        }),
    },
});
