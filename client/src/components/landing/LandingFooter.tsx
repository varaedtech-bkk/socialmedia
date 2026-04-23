export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-sky-500 text-sm font-bold text-white">
                SM
              </div>
              <span className="font-semibold text-slate-800">Social Media Manager</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Social Media Manager</p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Product</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li>
                <a href="#features" className="hover:text-indigo-600">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-indigo-600">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-indigo-600">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Access</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li>
                <a href="/auth" className="hover:text-indigo-600">
                  Log in
                </a>
              </li>
              <li>
                <a href="/request-access" className="hover:text-indigo-600">
                  Request access
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Policies</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li>
                <a href="#faq" className="hover:text-indigo-600">
                  FAQ and policy notes
                </a>
              </li>
              <li>
                <a href="/request-access" className="hover:text-indigo-600">
                  Contact for terms
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
