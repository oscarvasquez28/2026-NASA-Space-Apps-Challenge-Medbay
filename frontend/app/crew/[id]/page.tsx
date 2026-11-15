"use client";

/**
 * /crew/[id] — MEDBAY Astronaut View for the selected crew member (the same
 * shared SubjectView as `/`, keyed on the route param).
 */

import { use } from "react";

import { SubjectView } from "@/components/subject/SubjectView";
import { ViewerProvider } from "@/stores/viewer-store";

export default function CrewMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ViewerProvider key={id}>
      <SubjectView crewId={id} />
    </ViewerProvider>
  );
}
