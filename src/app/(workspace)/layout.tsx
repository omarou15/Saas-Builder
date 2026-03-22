export default function WorkspaceRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout — no sidebar, no dashboard chrome.
  // Auth is handled by Clerk middleware + the page's own auth() check.
  return <div className="h-screen overflow-hidden bg-background">{children}</div>;
}
