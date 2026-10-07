"use client";

import type { HTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AuroraBackgroundProps extends HTMLAttributes<HTMLDivElement> {
  showRadialGradient?: boolean;
}

/** Decorative backdrop: keeps the caller's height and semantic main landmark. */
export function AuroraBackground({ children, className, showRadialGradient = true, ...props }: AuroraBackgroundProps) {
  const reducedMotion = useReducedMotion();
  return (
    <div className={cn("relative isolate", className)} {...props}>
      <motion.div
        aria-hidden="true"
        initial={false}
        whileInView={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.8 }}
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-zinc-50"
      >
        <div className={cn("nora-aurora", showRadialGradient && "nora-aurora-radial")} />
      </motion.div>
      {children}
    </div>
  );
}
