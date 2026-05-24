import type { Session } from "better-auth";

// Extended user type — includes columns added by the better-auth admin plugin
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// Variables available on every Hono context via c.get(...)
export type HonoVariables = {
  user: AuthUser | null;
  session: Session | null;
  // set by validateBody middleware after Zod parsing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validatedBody: any;
};
