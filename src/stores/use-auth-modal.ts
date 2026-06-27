"use client";

import { create } from "zustand";

type AuthModalStore = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

/** Global login-modal visibility (opened by the header button or login gates). */
export const useAuthModal = create<AuthModalStore>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
