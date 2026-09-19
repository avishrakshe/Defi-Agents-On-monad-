import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface PathProgress {
  completedLessons: string[];
  totalLessons: number;
  completed: boolean; // every lesson + required quiz passed
  xpEarned: number;
  completedAt: string | null;
}

export interface AcademyProgress {
  userId: string; // wallet address or anonymous local id
  userName: string; // learner display name
  paths: {
    "monad-fundamentals": PathProgress;
    "tokenized-assets": PathProgress;
    "x402-payments": PathProgress;
  };
  totalXp: number;
  currentStreak: number;
  certificateEligible: boolean; // true only when all 3 PathProgress.completed === true
  certificateIssuedAt: string | null;
  certificateTokenId: string | null;
  certificateTxHash: string | null;

  // Actions
  setUserName: (name: string) => void;
  setUserId: (id: string) => void;
  completeLesson: (pathId: keyof AcademyProgress["paths"], lessonId: string, xp?: number) => void;
  markPathComplete: (pathId: keyof AcademyProgress["paths"]) => void;
  markAllCompleteForDemo: () => void;
  issueCertificate: (txHash?: string, tokenId?: string) => void;
  resetProgress: () => void;
}

const DEFAULT_PATHS: AcademyProgress["paths"] = {
  "monad-fundamentals": {
    completedLessons: [],
    totalLessons: 5,
    completed: false,
    xpEarned: 0,
    completedAt: null
  },
  "tokenized-assets": {
    completedLessons: [],
    totalLessons: 5,
    completed: false,
    xpEarned: 0,
    completedAt: null
  },
  "x402-payments": {
    completedLessons: [],
    totalLessons: 5,
    completed: false,
    xpEarned: 0,
    completedAt: null
  }
};

export const useAcademyStore = create<AcademyProgress>()(
  persist(
    (set, get) => ({
      userId: "0x39D1...C39B",
      userName: "Monad Scholar",
      paths: { ...DEFAULT_PATHS },
      totalXp: 0,
      currentStreak: 3,
      certificateEligible: false,
      certificateIssuedAt: null,
      certificateTokenId: null,
      certificateTxHash: null,

      setUserName: (userName: string) => set({ userName }),

      setUserId: (userId: string) => set({ userId }),

      completeLesson: (pathId, lessonId, xp = 50) => {
        const currentPaths = get().paths;
        const targetPath = currentPaths[pathId];
        if (!targetPath) return;

        const isAlreadyDone = targetPath.completedLessons.includes(lessonId);
        const updatedLessons = isAlreadyDone
          ? targetPath.completedLessons
          : [...targetPath.completedLessons, lessonId];

        const isPathComplete = updatedLessons.length >= targetPath.totalLessons;
        const additionalXp = isAlreadyDone ? 0 : xp;

        const updatedPath: PathProgress = {
          ...targetPath,
          completedLessons: updatedLessons,
          completed: isPathComplete,
          xpEarned: targetPath.xpEarned + additionalXp,
          completedAt: isPathComplete ? targetPath.completedAt || new Date().toISOString() : null
        };

        const updatedPaths = {
          ...currentPaths,
          [pathId]: updatedPath
        };

        // Auto-recompute certificateEligible across all 3 paths
        const allCompleted = Object.values(updatedPaths).every((p) => p.completed);

        set({
          paths: updatedPaths,
          totalXp: get().totalXp + additionalXp,
          certificateEligible: allCompleted
        });
      },

      markPathComplete: (pathId) => {
        const currentPaths = get().paths;
        const targetPath = currentPaths[pathId];
        if (!targetPath) return;

        // Populate all lesson IDs
        const mockLessons = Array.from({ length: targetPath.totalLessons }, (_, i) => `lesson-${i + 1}`);
        const updatedPath: PathProgress = {
          ...targetPath,
          completedLessons: mockLessons,
          completed: true,
          xpEarned: targetPath.totalLessons * 50,
          completedAt: new Date().toISOString()
        };

        const updatedPaths = {
          ...currentPaths,
          [pathId]: updatedPath
        };

        const allCompleted = Object.values(updatedPaths).every((p) => p.completed);

        set({
          paths: updatedPaths,
          totalXp: get().totalXp + (targetPath.totalLessons - targetPath.completedLessons.length) * 50,
          certificateEligible: allCompleted
        });
      },

      markAllCompleteForDemo: () => {
        const paths = { ...get().paths };
        for (const key of Object.keys(paths) as (keyof AcademyProgress["paths"])[]) {
          paths[key] = {
            ...paths[key],
            completedLessons: Array.from({ length: paths[key].totalLessons }, (_, i) => `lesson-${i + 1}`),
            completed: true,
            xpEarned: paths[key].totalLessons * 50,
            completedAt: new Date().toISOString()
          };
        }

        set({
          paths,
          totalXp: 750,
          certificateEligible: true
        });
      },

      issueCertificate: (txHash?: string, tokenId?: string) => {
        set({
          certificateIssuedAt: new Date().toISOString(),
          certificateTxHash: txHash || null,
          certificateTokenId: tokenId || null
        });
      },

      resetProgress: () => {
        set({
          paths: {
            "monad-fundamentals": {
              completedLessons: [],
              totalLessons: 5,
              completed: false,
              xpEarned: 0,
              completedAt: null
            },
            "tokenized-assets": {
              completedLessons: [],
              totalLessons: 5,
              completed: false,
              xpEarned: 0,
              completedAt: null
            },
            "x402-payments": {
              completedLessons: [],
              totalLessons: 5,
              completed: false,
              xpEarned: 0,
              completedAt: null
            }
          },
          totalXp: 0,
          certificateEligible: false,
          certificateIssuedAt: null,
          certificateTokenId: null,
          certificateTxHash: null
        });
      }
    }),
    {
      name: "monad-academy-progress-store",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
