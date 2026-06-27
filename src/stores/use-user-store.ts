"use client";

import { create } from "zustand";

import { adminLogin, fetchCurrentUser, logout, type AuthUser } from "@/services/api/auth";

type UserStore = {
  user: AuthUser | null;
  isReady: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  hydrate: () => Promise<void>;
  signInAdmin: (username: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

export const useUserStore = create<UserStore>()((set) => ({
  user: null,
  isReady: false,
  isLoading: false,
  setUser: (user) => set({ user, isReady: true }),
  hydrate: async () => {
    set({ isLoading: true });
    try {
      const user = await fetchCurrentUser();
      set({ user, isReady: true, isLoading: false });
    } catch {
      set({ user: null, isReady: true, isLoading: false });
    }
  },
  signInAdmin: async (username, password) => {
    set({ isLoading: true });
    try {
      const user = await adminLogin(username, password);
      set({ user, isReady: true, isLoading: false });
      return user;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  signOut: async () => {
    try {
      await logout();
    } catch {
      // ignore network failures during logout
    }
    set({ user: null });
  },
}));

export type { AuthUser };
