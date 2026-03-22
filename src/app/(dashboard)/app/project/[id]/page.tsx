import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 inline-flex rounded-2xl bg-orange-500/10 p-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h1 className="text-xl font-bold">Workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Le workspace (chat + preview) arrive en Session 9.
      </p>
      <p className="mt-1 text-xs text-muted-foreground/60">
        Project ID: {id}
      </p>
    </div>
  );
}
