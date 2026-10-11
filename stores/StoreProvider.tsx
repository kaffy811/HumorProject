"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { createMascotStore, type MascotStore } from "./mascot-store";
import { createCreateStore, type CreateStore } from "./create-store";
import { createFeedStore } from "./feed-store";
const StoresContext = createContext<{
  feed: ReturnType<typeof createFeedStore>;
  mascot: ReturnType<typeof createMascotStore>;
  create: ReturnType<typeof createCreateStore>;
} | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [stores] = useState(() => ({
    feed: createFeedStore(),
    mascot: createMascotStore(),
    create: createCreateStore(),
  }));
  useEffect(() => () => stores.mascot.getState().dispose(), [stores]);
  return (
    <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>
  );
}
export function useStores() {
  const stores = useContext(StoresContext);
  if (!stores) throw new Error("Member stores are unavailable");
  return stores;
}
export function useMascot<T>(selector: (s: MascotStore) => T) {
  return useStore(useStores().mascot, selector);
}
export function useCreate<T>(selector: (s: CreateStore) => T) {
  return useStore(useStores().create, selector);
}
