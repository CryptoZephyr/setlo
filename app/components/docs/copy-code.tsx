"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyCode({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      intent="ghost"
      size="sm"
      onPress={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {done ? "Copied" : "Copy"}
    </Button>
  );
}
