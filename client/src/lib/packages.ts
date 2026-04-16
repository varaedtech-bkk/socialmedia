// src/constants/packages.ts
export const PACKAGES = {
    STARTER: {
      id: "starter",
      posts: 40,
      price: 500, // ₹500 or ฿220
      features: ["1 post/hour max"]
    },
    PRO: {
      id: "pro",
      posts: 150,
      price: 1850, // ₹1,850 or ฿800
      features: ["5 posts/hour max"]
    },
    ENTERPRISE: {
      id: "enterprise",
      posts: 3000,
      price: 5000,
      features: ["Unlimited posting"]
    }
  } as const;
  
  export type PackageTier = keyof typeof PACKAGES;