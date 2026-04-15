import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-xl font-bold text-blue-600">VidForge</span>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/pricing"
              className="hidden text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors sm:block"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors sm:px-4"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-24">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          Create. Share.{" "}
          <span className="text-blue-600">Go viral.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base text-gray-500 sm:mt-6 sm:text-lg">
          TryVidForge UCG is the all-in-one platform for creators to produce,
          manage, and distribute user-generated video content at scale.
        </p>
        <div className="mt-8 flex w-full flex-col items-center gap-3 px-4 sm:mt-10 sm:w-auto sm:flex-row sm:gap-4 sm:px-0">
          <Link
            href="/signup"
            className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors sm:w-auto"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-gray-200 px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors sm:w-auto"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900 sm:mb-12 sm:text-3xl">
            Everything you need to create
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-3 text-3xl sm:mb-4">{f.icon}</div>
                <h3 className="mb-2 text-base font-semibold text-gray-900 sm:text-lg">
                  {f.title}
                </h3>
                <p className="text-sm text-gray-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-4 py-6 text-center text-sm text-gray-400 sm:px-6 sm:py-8">
        &copy; {new Date().getFullYear()} TryVidForge UCG. All rights reserved.
      </footer>
    </main>
  );
}

const features = [
  {
    icon: "🎬",
    title: "AI-Powered Editing",
    description:
      "Auto-cut, caption, and enhance your videos in seconds with our built-in AI tools.",
  },
  {
    icon: "📊",
    title: "Deep Analytics",
    description:
      "Track views, engagement, and conversions across every platform from one dashboard.",
  },
  {
    icon: "🚀",
    title: "One-Click Publishing",
    description:
      "Distribute to TikTok, YouTube Shorts, Instagram Reels, and more simultaneously.",
  },
];
