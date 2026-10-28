import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { systemInfo } from "@/lib/view";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "New proofhold" };

export default function NewProofholdPage() {
  return (
    <>
      <PageHeader
        title="New proofhold"
        lead="Describe the job. Get a test. Send one link."
      />
      <Composer system={systemInfo()} />
    </>
  );
}
