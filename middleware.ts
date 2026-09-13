import { NextResponse, type NextRequest } from "next/server";

const blockedPrefixes = [
  "/.git/",
  "/.next/",
  "/app/",
  "/components/",
  "/dist/",
  "/lib/",
  "/node_modules/",
  "/prisma/",
  "/scripts/",
  "/src/",
  "/supabase/"
];

const blockedNames = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".gitignore",
  "components.json",
  "eslint.config.js",
  "next.config.js",
  "next.config.mjs",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "postcss.config.js",
  "postcss.config.mjs",
  "tailwind.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "yarn.lock"
]);

const blockedExtensions = [
  ".bak",
  ".crt",
  ".db",
  ".env",
  ".html",
  ".key",
  ".local",
  ".log",
  ".map",
  ".orig",
  ".pem",
  ".p12",
  ".rej",
  ".sql",
  ".sqlite",
  ".sqlite3",
  ".ts",
  ".tsx"
];

function normalizePath(pathname: string) {
  try {
    return decodeURIComponent(pathname).toLowerCase();
  } catch {
    return pathname.toLowerCase();
  }
}

function isBlockedPath(pathname: string) {
  const normalized = normalizePath(pathname);
  if (
    normalized.startsWith("/_next/") ||
    normalized === "/favicon.ico" ||
    normalized === "/icon.svg" ||
    normalized === "/icon.png" ||
    normalized === "/icon-512.png" ||
    normalized === "/robots.txt" ||
    normalized === "/site.webmanifest"
  ) {
    return false;
  }

  const filename = normalized.split("/").pop() || "";

  return (
    blockedPrefixes.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)) ||
    blockedNames.has(filename) ||
    blockedExtensions.some((extension) => normalized.endsWith(extension))
  );
}

export function middleware(request: NextRequest) {
  if (!isBlockedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return new NextResponse("Not found", {
    status: 404,
    headers: {
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon.png|icon-512.png|robots.txt|site.webmanifest).*)"
  ]
};
