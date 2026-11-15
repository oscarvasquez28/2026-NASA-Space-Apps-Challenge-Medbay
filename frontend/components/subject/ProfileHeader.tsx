"use client";

/**
 * Profile square + name (spec §3): the square opens a tooltip to upload a
 * picture or choose a premade icon (local avatar — face credential untouched);
 * the name opens the logout tooltip. Technical view adds the hamburger that
 * opens the crew list.
 */

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { AstronautIcon } from "@/components/icons/medbay";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCheckIn } from "@/hooks/useCheckIn";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";
import type { CrewMember } from "@/types/health";

const PREMADE = ["orb", "tv-bot", "wave-cat", "rubber-hose"] as const;

export function ProfileHeader({
  member,
  technical,
  health,
}: {
  member: CrewMember | null;
  technical: boolean;
  health: "healthy" | "risk" | "critical";
}) {
  const router = useRouter();
  const { activeUser, isMedic } = useCheckIn();
  const users = useUserStore((s) => s.users);
  const extrasMap = useUserStore((s) => s.extras);
  const setAvatar = useUserStore((s) => s.setAvatar);
  const setSessionLocked = useUserStore((s) => s.setSessionLocked);
  const fileRef = useRef<HTMLInputElement>(null);

  // Map the viewed crew member back to the operator that owns it.
  const owner = users.find((u) => u.astronautId === member?.id);
  const isSelf = owner?.id === activeUser?.id;
  const avatar = owner ? extrasMap[owner.id]?.avatar : undefined;
  const photo = avatar ?? member?.facePhoto;
  const name = member?.name.toUpperCase() ?? "—";

  const tone =
    health === "critical" ? "bg-critical" : health === "risk" ? "bg-risk" : "bg-state";

  return (
    <div className="flex items-start gap-5">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "relative grid size-[76px] shrink-0 place-items-center overflow-hidden ring-2 ring-white/15 ring-offset-2 ring-offset-black transition-all hover:ring-white/30",
              tone,
            )}
            aria-label="Profile picture — upload a photo or choose an icon"
            disabled={!isSelf}
            title={isSelf ? undefined : "Only the operator can change their picture"}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-full object-cover" />
            ) : (
              <AstronautIcon size={42} className="text-black/70" />
            )}
          </button>
        </PopoverTrigger>
        {isSelf && (
          <PopoverContent className="w-60">
            <div className="medbay-micro mb-2 text-foreground/70">Profile picture</div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
              Upload a picture
            </Button>
            <div className="medbay-micro my-2 text-foreground/60">Or choose a premade icon</div>
            <div className="grid grid-cols-4 gap-1.5">
              {PREMADE.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAvatar(owner!.id, `mascot:${id}`)}
                  className={cn(
                    "grid aspect-square place-items-center border text-[9px] uppercase transition-colors",
                    avatar === `mascot:${id}` ? "border-state text-state" : "border-input hover:border-state",
                  )}
                  aria-label={`Use ${id} icon`}
                >
                  {id === "orb" ? "ORB" : id === "tv-bot" ? "BOT" : id === "wave-cat" ? "CAT" : "COMET"}
                </button>
              ))}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => setAvatar(owner!.id, String(reader.result));
                reader.readAsDataURL(f);
              }}
            />
          </PopoverContent>
        )}
      </Popover>

      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="medbay-display min-w-0 truncate text-left text-[clamp(26px,3.1vw,44px)] leading-none hover:text-state" aria-label={`${name} — options`}>
              {name}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="medbay-micro mb-2 truncate text-foreground/70">{member?.callsign ?? name}</div>
            {isSelf ? (
              <>
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setSessionLocked(true); router.push("/checkin"); }}>
                  Log out
                </Button>
                <Button variant="ghost" size="sm" className="mt-1 h-auto min-h-8 w-full whitespace-normal py-1.5 leading-tight" onClick={() => router.push("/checkin")}>
                  Switch operator (face scan)
                </Button>
              </>
            ) : (
              <p className="text-[11px] text-foreground/70">Viewing another crew member. Use the crew list to change the subject.</p>
            )}
          </PopoverContent>
        </Popover>
        {technical && isMedic && (
          <Button variant="ghost" size="icon" onClick={() => router.push("/crew")} aria-label="Crew list">
            <Menu size={30} />
          </Button>
        )}
      </div>
    </div>
  );
}
