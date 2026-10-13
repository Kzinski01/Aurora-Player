import { create } from "zustand";
import aurora from "../lib/aurora.js";
import logger from "../lib/logger.js";

const useProfileStore = create((set, get) => ({
  profile: null,
  avatarUrl: null,
  importPreview: null, // parsed .auroraProfile payload awaiting user confirmation

  async loadProfile() {
    try {
      const profile = await aurora.getProfile();
      set({ profile });
      await get().loadAvatarUrl();
    } catch (e) {
      logger.error("Falha ao carregar perfil", { message: e.message });
    }
  },

  async loadAvatarUrl() {
    try {
      set({ avatarUrl: await aurora.getProfileAvatarUrl() });
    } catch (e) {
      logger.error("Falha ao carregar avatar do perfil", { message: e.message });
    }
  },

  async setUsername(username) {
    try {
      set({ profile: await aurora.setProfileUsername(username) });
    } catch (e) {
      logger.error("Falha ao salvar nome de usuário", { message: e.message });
    }
  },

  async setPreferences(patch) {
    try {
      set({ profile: await aurora.setProfilePreferences(patch) });
    } catch (e) {
      logger.error("Falha ao salvar preferências do perfil", { message: e.message });
    }
  },

  async pickAvatar() {
    try {
      set({ profile: await aurora.pickProfileAvatar() });
      await get().loadAvatarUrl();
      return true;
    } catch (e) {
      logger.error("Falha ao escolher avatar", { message: e.message });
      return false;
    }
  },

  async exportProfile() {
    try {
      return await aurora.exportProfile();
    } catch (e) {
      logger.error("Falha ao exportar perfil", { message: e.message });
      return { path: null };
    }
  },

  // Only reads/validates the file and stages it — profile:applyImport (via
  // confirmImport below) is what actually overwrites the current profile,
  // so the caller can show a confirmation before committing.
  async pickImport() {
    try {
      const payload = await aurora.pickProfileImport();
      if (payload) set({ importPreview: payload });
      return payload;
    } catch (e) {
      logger.error("Falha ao ler arquivo de perfil", { message: e.message });
      throw e;
    }
  },

  async confirmImport() {
    const { importPreview } = get();
    if (!importPreview) return;
    try {
      const profile = await aurora.applyProfileImport(importPreview);
      set({ profile, importPreview: null });
      await get().loadAvatarUrl();
    } catch (e) {
      logger.error("Falha ao aplicar perfil importado", { message: e.message });
    }
  },

  cancelImport() {
    set({ importPreview: null });
  },
}));

export default useProfileStore;
