import { create } from "zustand";

interface GreetingState {
  visitCount: number;
  lastVisitor: string | null;
  incrementVisit: (name: string) => void;
}

export const useGreetingStore = create<GreetingState>((set) => ({
  visitCount: 0,
  lastVisitor: null,
  incrementVisit: (name) =>
    set((state) => ({
      visitCount: state.visitCount + 1,
      lastVisitor: name,
    })),
}));
