export function middleware(req) {
  const url = new URL(req.url);

  console.log("RAW PATHNAME:", JSON.stringify(url.pathname));

  return;
}

export const config = {
  matcher: ['/:path*'],
};
