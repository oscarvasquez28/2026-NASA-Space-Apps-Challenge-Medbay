"use client";

/**
 * / — MEDBAY Astronaut View of the checked-in operator (spec §3).
 * The subject is the active operator's own astronautId.
 */

import { SubjectView } from "@/components/subject/SubjectView";
import { useCheckIn } from "@/hooks/useCheckIn";
import { ViewerProvider } from "@/stores/viewer-store";

export default function MedbayHome() {
  const { activeUser } = useCheckIn();
  return (
    <ViewerProvider key={activeUser?.astronautId ?? "none"}>
      <SubjectView crewId={activeUser?.astronautId} />
    </ViewerProvider>
  );
}
