import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const BACKEND = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

// Augment the session/user with our role field.
declare module 'next-auth' {
  interface Session {
    user: { role?: string } & DefaultSession['user'];
  }
  interface User {
    role?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (creds) => {
        const email = creds?.email;
        const password = creds?.password;
        if (typeof email !== 'string' || typeof password !== 'string') return null;

        try {
          const res = await fetch(`${BACKEND}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) return null;
          const user = (await res.json()) as {
            id: string;
            email: string;
            name: string;
            role: string;
          };
          return user;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.role = user.role;
      if (!token.name || token.name === 'Ravi Venkatesan' || token.name === 'Ravi') {
        token.name = 'Velmurugan';
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.role = token.role as string | undefined;
        if (!session.user.name || session.user.name === 'Ravi Venkatesan' || session.user.name === 'Ravi') {
          session.user.name = (token.name as string) || 'Velmurugan';
        }
      }
      return session;
    },
  },
});
