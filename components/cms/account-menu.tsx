"use client";

import { motion } from "motion/react";

import { ChevronDown, LogOut } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { ThemeOptions } from "@/components/cms/theme-options";
import type { Row } from "@/lib/cms/types";

type AccountMenuProps = {
  user?: Row;
  roles?: string[];
  onSignOut: () => void;
};

export function AccountMenu({ user, roles, onSignOut }: AccountMenuProps) {
  const name =
    typeof user?.name === "string" && user.name.trim()
      ? user.name
      : "Admin account";
  const role = roles?.[0];
  const roleLabel =
    role === "ADMIN_SUPER"
      ? "Super admin"
      : role
        ? role
            .toLowerCase()
            .replaceAll("_", " ")
            .replace(/^./, (letter) => letter.toUpperCase())
        : "Administrator";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const phone = typeof user?.phone === "string" ? user.phone : null;
  const email = typeof user?.email === "string" ? user.email : null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 pr-2.5 pl-1 text-left text-[var(--ink)] transition-colors hover:border-[#dedfd8] hover:bg-[var(--surface-hover)] data-[state=open]:border-[#f0cbbb] data-[state=open]:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
          aria-label="Open admin account"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent-text)]"
            aria-hidden="true"
          >
            {initials}
          </span>
          <span className="hidden min-w-0 max-w-32 flex-col gap-0.5 min-[900px]:flex">
            <span className="truncate text-xs font-semibold leading-tight">
              {name}
            </span>
            <span className="truncate text-[10px] leading-tight text-[var(--muted)]">
              {roleLabel}
            </span>
          </span>
          <ChevronDown
            className="text-[var(--muted)] transition-transform group-data-[state=open]:rotate-180"
            size={14}
            aria-hidden="true"
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          asChild
          className="account-menu"
          align="end"
          sideOffset={10}
          collisionPadding={12}
        >
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <DropdownMenu.Label className="account-menu-heading">
              <span className="account-menu-avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="account-menu-identity">
                <strong>{name}</strong>
                <small>Signed in</small>
              </span>
            </DropdownMenu.Label>
            {(phone || email || !!roles?.length) && (
              <div className="account-menu-details">
                {phone && (
                  <div>
                    <span>Phone</span>
                    <strong>{phone}</strong>
                  </div>
                )}
                {email && (
                  <div>
                    <span>Email</span>
                    <strong>{email}</strong>
                  </div>
                )}
                {!!roles?.length && (
                  <div>
                    <span>Role{roles.length === 1 ? "" : "s"}</span>
                    <strong>
                      {roles
                        .map((role) => role.replaceAll("_", " "))
                        .join(", ")}
                    </strong>
                  </div>
                )}
              </div>
            )}
            <ThemeOptions />
            <DropdownMenu.Separator className="account-menu-separator" />
            <DropdownMenu.Item
              className="account-menu-signout"
              onSelect={onSignOut}
            >
              <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
              Sign out
            </DropdownMenu.Item>
          </motion.div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
