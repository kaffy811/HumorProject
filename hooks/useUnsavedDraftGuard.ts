"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStores } from "@/stores/StoreProvider";
import { hasUnpublishedContent } from "@/stores/create-store";
export function useUnsavedDraftGuard() {
  const { create } = useStores();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const approved = useRef(false);
  useEffect(() => {
    let armed = false;
    const dirty = () =>
      !approved.current && hasUnpublishedContent(create.getState());
    const arm = () => {
      if (!armed && dirty()) {
        const state = history.state;
        history.replaceState(
          { ...state, humorGuardBase: true },
          "",
          location.href,
        );
        history.pushState(
          { ...state, humorGuardSentinel: true },
          "",
          location.href,
        );
        armed = true;
      }
    };
    const unsubscribe = create.subscribe(arm);
    arm();
    const ask = (proceed: () => void) => {
      pending.current = proceed;
      setOpen(true);
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const click = (event: MouseEvent) => {
      if (
        !dirty() ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href);
      if (
        url.href === window.location.href ||
        (url.hash && url.pathname === window.location.pathname)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      ask(() => {
        if (url.origin === location.origin)
          router.push(url.pathname + url.search + url.hash);
        else location.assign(url.href);
      });
    };
    const intent = (event: Event) => {
      if (!dirty()) return;
      event.preventDefault();
      ask((event as CustomEvent<{ proceed: () => void }>).detail.proceed);
    };
    const pop = () => {
      if (!armed) return;
      if (dirty()) {
        history.pushState(
          { ...history.state, humorGuardSentinel: true },
          "",
          location.href,
        );
        ask(() => history.go(-2));
      } else if (history.state?.humorGuardBase) {
        history.back();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop);
    window.addEventListener("humor:leave", intent);
    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", pop);
      window.removeEventListener("humor:leave", intent);
    };
  }, [create, router]);
  return {
    open,
    cancel: () => {
      pending.current = null;
      setOpen(false);
    },
    leave: () => {
      approved.current = true;
      setOpen(false);
      pending.current?.();
      pending.current = null;
    },
  };
}
