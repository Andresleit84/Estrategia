import { create } from "zustand";

interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  presentationMode: boolean;
  presentationCompany: string;
  enterPresentation: (company: string) => void;
  exitPresentation: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  presentationMode: false,
  presentationCompany: "",
  enterPresentation: (company: string) => set({ presentationMode: true, presentationCompany: company }),
  exitPresentation: () => set({ presentationMode: false, presentationCompany: "" }),
}));
