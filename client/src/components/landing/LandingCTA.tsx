import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function LandingCTA() {
  return (
    <section className="my-20 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 p-8 text-center text-white shadow-xl">
      <h2 className="text-2xl font-bold md:text-3xl">Ready to streamline your social media workflow?</h2>
      <p className="mx-auto mt-3 max-w-md text-indigo-100">
        Start your trial and bring publishing, approvals, and governance into one place.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <Link href="/auth">
          <Button className="rounded-full bg-white px-6 py-5 text-indigo-600 shadow-lg transition-all hover:bg-indigo-50">
            Start your free trial
          </Button>
        </Link>
        <Link href="/request-access">
          <Button className="rounded-full border border-white/30 bg-transparent px-6 py-5 text-white transition-all hover:bg-white/10">
            Request access
          </Button>
        </Link>
      </div>
    </section>
  );
}
