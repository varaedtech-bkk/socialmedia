import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LandingAnnouncement,
  LandingCTA,
  LandingFAQ,
  LandingFeatures,
  LandingFooter,
  LandingHeader,
  LandingHero,
  LandingHowItWorks,
  LandingPricing,
  LandingSocialProof,
  LandingTestimonials,
} from "@/components/landing";

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/app");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 via-white to-indigo-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 text-slate-900">
      <LandingAnnouncement />
      <LandingHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <LandingHero />
        <LandingSocialProof />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingPricing />
        <LandingTestimonials />
        <LandingFAQ />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
}