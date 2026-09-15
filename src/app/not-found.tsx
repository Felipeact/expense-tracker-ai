import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-12 text-center">
      <p className="text-sm font-semibold text-accent-ink">404</p>
      <h1 className="mt-2 text-lg font-semibold text-ink">Page not found</h1>
      <p className="mt-1 text-sm text-ink-2">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="btn-primary mt-6">
        Back to dashboard
      </Link>
    </div>
  );
}
