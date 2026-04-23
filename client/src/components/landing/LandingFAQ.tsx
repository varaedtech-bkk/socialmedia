import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type Faq = {
  question: string;
  answer: string;
};

const faqs: Faq[] = [
  {
    question: "How does the access request workflow work?",
    answer:
      "Users request access first. Super admins approve from the admin dashboard, then approved users can log in and start their trial.",
  },
  {
    question: "Do I need a credit card to start the trial?",
    answer: "No. The 7-day trial starts without a card. Billing starts only when you upgrade.",
  },
  {
    question: "How does BYOK AI work?",
    answer:
      "Each user provides their own OpenRouter API key. AI features run only with that key, with no hidden platform fallback key.",
  },
  {
    question: "Can we manage team permissions?",
    answer:
      "Yes. The platform includes role-based controls with super_admin/client and owner/moderator scopes.",
  },
];

function FAQItem({ question, answer }: Faq) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button onClick={() => setIsOpen(!isOpen)} className="flex w-full items-center justify-between py-4 text-left">
        <span className="font-medium text-slate-900">{question}</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && <div className="pb-4 text-sm leading-relaxed text-slate-600">{answer}</div>}
    </div>
  );
}

export function LandingFAQ() {
  return (
    <section id="faq" className="my-20 scroll-mt-20">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Frequently asked{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">questions</span>
        </h2>
      </div>
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {faqs.map((faq) => (
          <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </section>
  );
}
