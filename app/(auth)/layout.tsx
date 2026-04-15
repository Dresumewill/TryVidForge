// This layout is a safety net: middleware already redirects authenticated
// users away from auth routes, but this catches any cases middleware misses
// (e.g. direct server-side navigation).
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
