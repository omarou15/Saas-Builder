// Override the default dashboard layout for the workspace page.
// The parent layout applies p-6/p-8 padding on <main> which we need
// to negate for the full-screen workspace experience.

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-m-6 lg:-m-8 h-[calc(100%+3rem)] lg:h-[calc(100%+4rem)]">
      {children}
    </div>
  );
}
