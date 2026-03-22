import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId } from "@/lib/credits";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import type { Project } from "@/types";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const { id } = await params;

  // Lookup FYREN user
  const user = await getUserByClerkId(clerkId);
  if (!user) redirect("/sign-in");

  // Fetch project with ownership check
  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!project) notFound();

  // Cast to typed Project
  const typedProject: Project = {
    id: project.id as string,
    user_id: project.user_id as string,
    name: project.name as string,
    slug: project.slug as string,
    status: project.status as Project["status"],
    cdc_json: project.cdc_json as Project["cdc_json"],
    stack_config: project.stack_config as Project["stack_config"],
    sandbox_id: project.sandbox_id as Project["sandbox_id"],
    created_at: project.created_at as string,
    updated_at: project.updated_at as string,
  };

  return <WorkspaceLayout project={typedProject} />;
}
