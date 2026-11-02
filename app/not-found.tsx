import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div
      role="main"
      className="relative flex min-h-screen max-w-none flex-col overflow-hidden bg-[#f8f9f6] p-0 text-[#1d2721] dark:bg-[#151515] dark:text-[#f2f1ee]"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-6 sm:px-12 sm:py-8">
        <Link
          href="/"
          aria-label="Ryno workspace home"
          className="inline-flex items-center gap-2.5"
        >
          <Image
            src="/icon.png"
            alt=""
            width={36}
            height={36}
            className="rounded-full"
          />
          <span className="text-lg font-bold tracking-tight">
            ryno
            <span className="ml-2 border-l border-[#d9ded8] pl-2 text-xs font-medium tracking-normal text-[#7b837b] dark:border-[#42423f] dark:text-[#b6b5af]">
              operations
            </span>
          </span>
        </Link>
        <span className="hidden text-xs font-medium text-[#89918a] dark:text-[#b6b5af] sm:block">
          RYNO WORKSPACE
        </span>
      </div>
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-36 pt-12 text-center sm:pb-44">
        <span className="text-xs font-semibold tracking-[0.12em] text-[#9a6957] dark:text-[#ffb08d] uppercase">
          404 · Not found
        </span>
        <h1
          style={{
            marginTop: 20,
            fontSize: "clamp(2rem, 4vw, 3.5rem)",
            fontWeight: 600,
            lineHeight: 1.1,
          }}
          className="mt-5 text-[clamp(2rem,4vw,3.5rem)] leading-[1.1] font-semibold tracking-[-0.045em]"
        >
          Page not found
        </h1>
        <p
          style={{ marginTop: 16 }}
          className="mt-4 max-w-sm text-sm leading-6 text-[#788079] dark:text-[#b6b5af] sm:text-base"
        >
          We couldn’t find the page you’re looking for. Let’s get you back to
          your workspace.
        </p>
        <Link
          href="/"
          style={{ color: "white" }}
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#202a23] px-5 dark:bg-[#bf491b] dark:hover:bg-[#d55a28] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#334239] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d64a16]"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to dashboard
        </Link>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-52 overflow-hidden sm:h-72"
      >
        <div className="absolute inset-x-0 top-0 flex justify-around text-[clamp(6rem,16vw,14rem)] leading-none font-light tracking-[0.08em] text-[#e7ebe5] dark:text-[#2d2d2d]">
          <span>404</span>
          <span className="hidden text-white sm:block dark:text-[#383838]">
            404
          </span>
          <span className="hidden lg:block">404</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-20 border-t border-white/70 bg-[linear-gradient(100deg,#ffe9d9,#ffd5be_50%,#fff1d6)] dark:border-[#42423f] dark:bg-[linear-gradient(100deg,#292929,#5a3728_50%,#292929)] sm:h-28" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(to_right,rgba(255,255,255,0.65)_1px,transparent_1px)] bg-size-[72px_100%] sm:h-28" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-r from-[#f8f9f6] via-transparent to-[#f8f9f6] dark:from-[#151515] dark:to-[#151515] sm:h-28" />
      </div>
    </div>
  );
}
