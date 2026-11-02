"use client";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  Building2,
  CircleHelp,
  Database,
  FileBarChart,
  LayoutDashboard,
  Megaphone,
  Package,
  Radio,
  UsersRound,
  WalletCards,
} from "lucide-react";

const navigationIcons = [
  LayoutDashboard,
  Package,
  FileBarChart,
  Megaphone,
  UsersRound,
  BarChart3,
  Database,
  WalletCards,
];
import { sections } from "@/components/cms/navigation";
export function Sidebar({
  mobile,
  setMobile,
  section,
}: {
  mobile: boolean;
  setMobile: (value: boolean) => void;
  section: string;
}) {
  return (
    <aside className={"sidebar " + (mobile ? "open" : "")}>
      <Link href="/" className="brand" aria-label="Ryno mobility home">
        <Image
          src="/ryno-logo.png"
          width={144}
          height={66}
          alt="Ryno mobility"
          priority
        />
      </Link>
      <div className="location">
        <span>
          <Building2 size={20} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <div>
          <strong>Bengaluru</strong>
          <small>All zones · IN</small>
        </div>
      </div>
      <nav aria-label="Main navigation">
        {sections.map((name, i) => {
          const NavigationIcon = navigationIcons[i];
          return (
            <Link
              href={name === "Dashboard" ? "/" : "/" + name.toLowerCase()}
              key={name}
              className={section === name ? "active" : ""}
              aria-current={section === name ? "page" : undefined}
              onClick={() => setMobile(false)}
            >
              <NavigationIcon size={20} strokeWidth={1.7} aria-hidden="true" />
              {name}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-note">
        <span className="broadcast">
          <Radio size={20} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <strong>Every delivery counts.</strong>
        <p>
          Delivering more.
          <br />
          Worrying less.
        </p>
      </div>
      <Link href="/help" className="help" onClick={() => setMobile(false)}>
        <CircleHelp size={17} strokeWidth={1.7} aria-hidden="true" />
        Help &amp; support
      </Link>
    </aside>
  );
}
