import { Resend } from "resend";

const SITE_DOMAIN = process.env.SITE_DOMAIN ?? "shirvargicake.in";
const SITE_URL = process.env.SITE_URL ?? `https://${SITE_DOMAIN}`;
const SHOP_NAME = process.env.SHOP_NAME ?? "Shivragi Cake";

export type WelcomeMessageType = "user-register";

export type OtpEmailType =
    | "sign-in"
    | "email-verification"
    | "forget-password"
    | "change-email";

const otpSubjects: Record<OtpEmailType, string> = {
    "sign-in": `Your ${SHOP_NAME} sign-in code`,
    "email-verification": `Verify your email — ${SHOP_NAME}`,
    "forget-password": `Reset your password — ${SHOP_NAME}`,
    "change-email": `Confirm your email change — ${SHOP_NAME}`,
};

const otpHeadings: Record<OtpEmailType, string> = {
    "sign-in": "Sign in to your account",
    "email-verification": "Verify your email address",
    "forget-password": "Reset your password",
    "change-email": "Confirm your email change",
};

const otpDescriptions: Record<OtpEmailType, string> = {
    "sign-in": `Use the code below to sign in to your ${SHOP_NAME} account. We can't wait to help you order something sweet.`,
    "email-verification": `Please confirm your email so we can keep you updated on orders, offers, and fresh bakes from ${SHOP_NAME}.`,
    "forget-password": `No worries — enter this code to securely reset your password and get back to browsing our cakes.`,
    "change-email": `Enter this code to confirm your new email address for your ${SHOP_NAME} account.`,
};

const otpPreheaders: Record<OtpEmailType, string> = {
    "sign-in": `Your sign-in code for ${SHOP_NAME} — expires in 5 minutes.`,
    "email-verification": `Verify your email for ${SHOP_NAME} — code expires in 5 minutes.`,
    "forget-password": `Reset your ${SHOP_NAME} password — code expires in 5 minutes.`,
    "change-email": `Confirm your email change at ${SHOP_NAME} — code expires in 5 minutes.`,
};

const welcomeSubjects: Record<WelcomeMessageType, string> = {
    "user-register": `Welcome to ${SHOP_NAME} — sweet things await!`,
};

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

/** Bakery palette — warm, appetizing, trustworthy */
const colors = {
    cream: "#FFF8F3",
    blush: "#FDE8E4",
    rose: "#E8A4A0",
    chocolate: "#4A3228",
    cocoa: "#6B4F45",
    gold: "#C4956A",
    white: "#FFFFFF",
    muted: "#8B7355",
} as const;

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

type EmailLayoutOptions = {
    preheader: string;
    body: string;
};

function emailLayout({ preheader, body }: EmailLayoutOptions): string {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(SHOP_NAME)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 620px) {
      .wrapper { width: 100% !important; }
      .content-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .hero-title { font-size: 26px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${colors.cream};font-family:Georgia,'Times New Roman',serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}&#847;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${colors.cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="wrapper" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:${colors.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(74,50,40,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${colors.blush} 0%,${colors.rose} 50%,${colors.gold} 100%);padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="content-pad" align="center" style="padding:36px 40px 28px;">
                    <p style="margin:0 0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${colors.chocolate};opacity:0.85;">Artisan bakery</p>
                    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;color:${colors.chocolate};letter-spacing:-0.02em;">${escapeHtml(SHOP_NAME)}</h1>
                    <p style="margin:12px 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${colors.cocoa};">Handcrafted cakes, baked with love</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="content-pad" style="padding:40px 48px 32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:${colors.cream};border-top:1px solid ${colors.blush};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="content-pad" align="center" style="padding:28px 40px 32px;">
                    <p style="margin:0 0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${colors.muted};">
                      <a href="${SITE_URL}" style="color:${colors.chocolate};text-decoration:none;font-weight:600;">${escapeHtml(SITE_DOMAIN)}</a>
                    </p>
                    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${colors.muted};">
                      &copy; ${year} ${escapeHtml(SHOP_NAME)}. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function ctaButton(label: string, href: string): string {
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px auto 0;">
  <tr>
    <td align="center" style="border-radius:999px;background-color:${colors.chocolate};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:${colors.white};text-decoration:none;letter-spacing:0.02em;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

function otpCodeBox(otp: string): string {
    const safeOtp = escapeHtml(otp);
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
  <tr>
    <td align="center" style="background:linear-gradient(180deg,${colors.cream} 0%,${colors.blush} 100%);border:2px dashed ${colors.rose};border-radius:16px;padding:28px 24px;">
      <p style="margin:0 0 12px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:${colors.muted};">Your verification code</p>
      <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;letter-spacing:0.35em;color:${colors.chocolate};">${safeOtp}</p>
    </td>
  </tr>
</table>`;
}

function otpEmailHtml(type: OtpEmailType, otp: string): string {
    const heading = escapeHtml(otpHeadings[type]);
    const description = escapeHtml(otpDescriptions[type]);

    const content = `
      <p class="hero-title" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:${colors.chocolate};line-height:1.3;">${heading}</p>
      <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:${colors.cocoa};">${description}</p>
      ${otpCodeBox(otp)}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${colors.cream};border-radius:12px;border:1px solid ${colors.blush};">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${colors.muted};text-align:center;">
              &#9201; This code expires in <strong style="color:${colors.chocolate};">5 minutes</strong>
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:${colors.muted};text-align:center;">
        If you didn't request this, you can safely ignore this email — your account stays secure.
      </p>`;

    return emailLayout({
        preheader: otpPreheaders[type],
        body: content,
    });
}

function welcomeEmailHtml(greeting: string, body: string): string {
    const safeGreeting = escapeHtml(greeting);
    const safeBody = escapeHtml(body);

    const content = `
      <p class="hero-title" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:${colors.chocolate};line-height:1.3;">${safeGreeting}</p>
      <p style="margin:0 0 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:${colors.cocoa};">${safeBody}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;background-color:${colors.cream};border-radius:12px;border:1px solid ${colors.blush};">
        <tr>
          <td style="padding:20px 24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="33%" align="center" style="padding:8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${colors.cocoa};">
                  <span style="font-size:22px;display:block;margin-bottom:6px;">&#127874;</span>
                  Fresh daily
                </td>
                <td width="33%" align="center" style="padding:8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${colors.cocoa};">
                  <span style="font-size:22px;display:block;margin-bottom:6px;">&#127856;</span>
                  Custom designs
                </td>
                <td width="33%" align="center" style="padding:8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${colors.cocoa};">
                  <span style="font-size:22px;display:block;margin-bottom:6px;">&#128666;</span>
                  Local delivery
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      ${ctaButton("Explore our cakes", SITE_URL)}
      <p style="margin:28px 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:${colors.muted};text-align:center;">
        Questions? Reply to this email — we're happy to help you pick the perfect cake.
      </p>`;

    return emailLayout({
        preheader: `Welcome to ${SHOP_NAME}! Your account is ready — browse cakes and order online.`,
        body: content,
    });
}

function sendEmail(data: {
    to: string;
    subject: string;
    text: string;
    html: string;
    logLabel: string;
}): void {
    const { to, subject, text, html, logLabel } = data;

    if (!resend || !process.env.RESEND_FROM_EMAIL) {
        console.warn(
            "[auth] RESEND_API_KEY or RESEND_FROM_EMAIL not set — logging email instead",
        );
        return;
    }

    void resend.emails
        .send({
            from: process.env.RESEND_FROM_EMAIL,
            to,
            subject,
            text,
            html,
        })
        .then(({ error }) => {
            if (error) {
                console.error(`[auth] Resend failed for ${to}:`, error);
            }
        })
        .catch((err) => {
            console.error(`[auth] Resend error for ${to}:`, err);
        });
}

export function sendOtpEmail(data: {
    email: string;
    otp: string;
    type: OtpEmailType;
}): void {
    const { email, otp, type } = data;
    const heading = otpHeadings[type];
    const text = `${heading}\n\n${otpDescriptions[type]}\n\nYour verification code: ${otp}\n\nThis code expires in 5 minutes. If you did not request it, you can ignore this email.\n\n— ${SHOP_NAME}\n${SITE_DOMAIN}`;
    const html = otpEmailHtml(type, otp);

    sendEmail({
        to: email,
        subject: otpSubjects[type],
        text,
        html,
        logLabel: `OTP (${type})`,
    });
}

export function sendWelcomeMessage(data: {
    to: string;
    name?: string | null;
    type: WelcomeMessageType;
}): void {
    const { to, name, type } = data;
    const greeting = name?.trim() ? `Welcome, ${name.trim()}!` : "Welcome to our bakery!";
    const body =
        type === "user-register"
            ? `We're delighted you've joined ${SHOP_NAME}. Your account is all set — discover celebration cakes, birthday favourites, and everyday treats made fresh for you.`
            : `Thank you for being part of the ${SHOP_NAME} family.`;
    const text = `${greeting}\n\n${body}\n\nExplore our cakes: ${SITE_URL}\n\nFresh daily · Custom designs · Local delivery\n\n— ${SHOP_NAME}\n${SITE_DOMAIN}`;
    const html = welcomeEmailHtml(greeting, body);

    sendEmail({
        to,
        subject: welcomeSubjects[type],
        text,
        html,
        logLabel: `Welcome (${type})`,
    });
}
