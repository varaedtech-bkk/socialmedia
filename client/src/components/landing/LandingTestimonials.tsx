const testimonials = [
  "Helped us streamline approvals and reduce onboarding back-and-forth.",
  "The BYOK AI policy gave our team cost transparency from day one.",
  "Publishing workflows are now clearer and easier to manage across channels.",
];

export function LandingTestimonials() {
  return (
    <section id="testimonials" className="my-20 scroll-mt-20">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          What teams are{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">saying</span>
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map((quote) => (
          <div key={quote} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm leading-relaxed text-slate-600">"{quote}"</p>
          </div>
        ))}
      </div>
    </section>
  );
}
