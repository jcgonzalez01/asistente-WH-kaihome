import { NextRequest, NextResponse } from "next/server";

const USER = process.env.BASIC_AUTH_USER;
const PASSWORD = process.env.BASIC_AUTH_PASSWORD;
const REALM = "Agente WhatsApp";

function unauthorized() {
  return new NextResponse("Autenticacion requerida", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}

function serverAuthNotConfigured() {
  return new NextResponse("Basic auth no configurado", { status: 503 });
}

function parseBasicAuth(header: string | null) {
  if (!header?.startsWith("Basic ")) return null;

  try {
    const decoded = atob(header.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;

    return {
      user: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  if (!USER || !PASSWORD) {
    return process.env.NODE_ENV === "production"
      ? serverAuthNotConfigured()
      : NextResponse.next();
  }

  const credentials = parseBasicAuth(req.headers.get("authorization"));
  if (credentials?.user === USER && credentials.password === PASSWORD) {
    return NextResponse.next();
  }

  return unauthorized();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt)$).*)",
  ],
};
