"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchBootstrap, isAuthenticated } from "@/lib/api";
import type { BootstrapData } from "@/lib/api";

type State =
  | { status: "loading" }
  | { status: "ok"; data: BootstrapData }
  | { status: "error"; message: string };

export function useBootstrap(): State {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    if (!isAuthenticated()) {
      router.replace("/");
      return;
    }

    const controller = new AbortController();
    // 15-second hard timeout — prevents the skeleton from hanging forever
    const timer = setTimeout(() => {
      controller.abort();
      setState({ status: "error", message: "Request timed out — is the API server running?" });
    }, 15_000);

    fetchBootstrap()
      .then((data) => {
        clearTimeout(timer);
        setState({ status: "ok", data });
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        if ((err as { name?: string }).name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Failed to load data.";
        // If the token was cleared by request() (401 handling), redirect to login
        if (!isAuthenticated()) {
          router.replace("/");
          return;
        }
        setState({ status: "error", message: msg });
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [router]);

  return state;
}
