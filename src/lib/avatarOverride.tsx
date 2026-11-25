import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AvatarOverrideContextType {
  avatarSeedOverrides: Record<string, string | null>;
  setAvatarSeedOverride: (userId: string, avatarSeed: string | null) => void;
}

const AvatarOverrideContext = createContext<AvatarOverrideContextType | undefined>(undefined);

export function AvatarOverrideProvider({ children }: { children: ReactNode }) {
  const [avatarSeedOverrides, setAvatarSeedOverrides] = useState<Record<string, string | null>>(
    {}
  );

  const setAvatarSeedOverride = useCallback((userId: string, avatarSeed: string | null) => {
    setAvatarSeedOverrides((prev) => {
      const next = { ...prev };
      if (avatarSeed === null) {
        const nextCopy = { ...next };
        delete nextCopy[userId];
        return nextCopy;
      }
      next[userId] = avatarSeed;
      return next;
    });
  }, []);

  return (
    <AvatarOverrideContext.Provider value={{ avatarSeedOverrides, setAvatarSeedOverride }}>
      {children}
    </AvatarOverrideContext.Provider>
  );
}

export function useAvatarSeedOverride(userId: string): string | null {
  const ctx = useContext(AvatarOverrideContext);
  if (!ctx) return null;
  return ctx.avatarSeedOverrides[userId] ?? null;
}
