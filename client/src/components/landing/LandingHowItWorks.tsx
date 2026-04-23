type Step = {
  step: string;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    step: "01",
    title: "Request and activate",
    description: "Submit access request, receive admin approval, and begin your 7-day trial.",
  },
  {
    step: "02",
    title: "Connect and configure",
    description: "Link social accounts, set roles, and add your OpenRouter key for AI-assisted workflows.",
  },
  {
    step: "03",
    title: "Publish and optimize",
    description: "Schedule, publish, and review performance from one operational dashboard.",
  },
];

export function LandingHowItWorks() {
  return (
    <section className="my-20">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          From request to results in{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">3 steps</span>
        </h2>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {steps.map((item) => (
          <div key={item.step} className="relative rounded-xl border border-slate-200 bg-white p-6 text-center">
            <div className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-indigo-600 to-sky-600 px-2 py-0.5 text-xs font-bold text-white">
              Step {item.step}
            </div>
            <h3 className="mb-2 mt-4 text-xl font-bold text-slate-900">{item.title}</h3>
            <p className="text-sm text-slate-600">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
