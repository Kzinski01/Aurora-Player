import { create } from "zustand";

let toastId = 0;

const useUIStore = create((set, get) => ({
  view: "download", // "download" | "queue" | "library" | "settings"
  setView: (view) => set({ view }),

  rightPanelOpen: false,
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),

  toasts: [],
  pushToast: (toast) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, tone: "info", duration: 3200, ...toast }] }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export default useUIStore;
