import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentWorkspace } from "@/lib/session/workspace";
import { StartForm } from "./start-form";

export const metadata: Metadata = { title: "Start" };

export default async function StartPage() {
  if (await currentWorkspace()) redirect("/app");
  return <StartForm />;
}
