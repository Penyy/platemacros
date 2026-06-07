import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type FeedbackType = "bug" | "suggestion" | "other";

const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: "Błąd",
  suggestion: "Sugestia",
  other: "Inne",
};

const APP_VERSION = "0.1";
const COOLDOWN_SEC = 30;

export function FeedbackSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<FeedbackType | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setMessage("");
      setType(null);
      setRating(null);
      setTimeout(() => taRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }

  async function handleSend() {
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      toast.error("Wiadomość musi mieć co najmniej 5 znaków.");
      return;
    }
    if (trimmed.length > 2000) {
      toast.error("Wiadomość może mieć maks. 2000 znaków.");
      return;
    }
    if (sending || cooldown > 0) return;

    setSending(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        toast.error("Musisz być zalogowany.");
        return;
      }
      const { error } = await supabase.from("feedback").insert({
        user_id: uid,
        message: trimmed,
        type,
        rating,
        app_version: APP_VERSION,
      });
      if (error) {
        const msg = error.message || "Nie udało się wysłać opinii.";
        if (/Limit|identyczn/i.test(msg)) {
          toast.error(msg);
        } else {
          toast.error("Nie udało się wysłać opinii.");
        }
        return;
      }
      toast.success("Dzięki za opinię!");
      setCooldown(COOLDOWN_SEC);
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  }

  const len = message.trim().length;
  const canSend = len >= 5 && len <= 2000 && !sending && cooldown === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0">
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle>Prześlij opinię</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-5 pb-6">
          <textarea
            ref={taRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              autoGrow();
            }}
            placeholder="Co możemy poprawić? Co Ci się podoba?"
            className="min-h-[110px] w-full resize-none rounded-xl border border-border/60 bg-card px-3 py-2 text-[15px] outline-none focus:ring-1 focus:ring-primary"
            maxLength={2000}
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>min. 5 znaków</span>
            <span>{len}/2000</span>
          </div>

          <div>
            <div className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Typ (opcjonalnie)
            </div>
            <div className="flex gap-0.5 rounded-full bg-foreground/5 p-0.5">
              {(["bug", "suggestion", "other"] as FeedbackType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(type === t ? null : t)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    type === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ocena (opcjonalnie)
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(rating === n ? null : n)}
                  className="p-1"
                  aria-label={`${n} gwiazdek`}
                >
                  <Star
                    size={26}
                    className={
                      rating !== null && n <= rating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground"
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-full rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground transition disabled:opacity-50"
          >
            {sending
              ? "Wysyłam…"
              : cooldown > 0
                ? `Poczekaj ${cooldown}s`
                : "Wyślij"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
