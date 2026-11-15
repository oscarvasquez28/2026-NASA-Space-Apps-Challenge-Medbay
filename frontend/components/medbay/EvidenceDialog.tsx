"use client";

/**
 * Evidence capture (spec §8, ADMIN VIEW PHOTO EVIDENCE) — camera icon.
 * ADD NEW EVIDENCE → UPLOAD or TAKE; the photo + provided context is sent to
 * the Visual AI as `diagnostic_image_base64` (POST /api/v1/ai/chat).
 * The persisted evidence history list is deferred until a backend endpoint
 * exists.
 */

import { useRef, useState } from "react";

import { CameraIcon } from "@/components/icons/medbay";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FaceCapture } from "@/components/ui/FaceCapture";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAICompanion } from "@/hooks/useAICompanion";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useAppStore } from "@/stores/app-store";
import { useCompanionStore } from "@/stores/companion-store";

const stripDataUrl = (u: string) => u.slice(u.indexOf(",") + 1);

export function EvidenceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { activeUser } = useCheckIn();
  const boundCrew = useCompanionStore((s) => s.crewId);
  const subjectId = boundCrew ?? activeUser?.astronautId;
  const { send } = useAICompanion(subjectId);
  const forceOffline = useAppStore((s) => s.forceOffline);
  const [photo, setPhoto] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setPhoto(null);
      setContext("");
      setSent(false);
    }
  };

  const submit = () => {
    if (!photo) return;
    void send(
      `Evidence photo uploaded${activeUser ? ` by ${activeUser.name}` : ""}. Context: ${context.trim() || "no context provided"}. Assess the visible finding and its severity.`,
      null,
      undefined,
      { diagnosticImageBase64: stripDataUrl(photo), forceOffline },
    );
    setSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="w-[min(94vw,760px)]">
        <DialogTitle className="medbay-display text-2xl">Evidence photos</DialogTitle>
        <DialogDescription className="sr-only">
          Upload or take a photo of a symptom and send it to the Visual AI.
        </DialogDescription>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-2 border border-input p-4">
            <div className="medbay-copy text-sm">Provided context</div>
            <Textarea
              rows={9}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Where is it, since when, does it itch or hurt?"
              aria-label="Evidence context"
            />
          </div>

          <div className="flex flex-col gap-3 border border-input p-4">
            <div className="flex items-center gap-2 medbay-copy text-sm uppercase">
              <CameraIcon size={16} /> Add new evidence
            </div>
            <Tabs defaultValue="take">
              <TabsList>
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="take">Take</TabsTrigger>
              </TabsList>
              <TabsContent value="upload">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Evidence" className="aspect-[4/3] w-full border border-input object-cover" />
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                    Choose image
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => setPhoto(String(reader.result));
                    reader.readAsDataURL(f);
                  }}
                />
              </TabsContent>
              <TabsContent value="take">
                <FaceCapture
                  mode="capture"
                  maxEdge={1024}
                  captureLabel="Take photo"
                  onCapture={setPhoto}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!photo || sent || !subjectId} onClick={submit}>
            {sent ? "Sent to Visual AI" : "Send to Visual AI"}
          </Button>
          <span className="medbay-micro text-muted-foreground">
            {sent
              ? "The assessment appears in the Visual AI panel."
              : "Evidence history (search, severity filters) arrives with the evidence backend."}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
