"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { DropdownMenu } from "radix-ui";
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
  const phone = typeof user?.phone === "string" ? user.phone : null;
  const email = typeof user?.email === "string" ? user.email : null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="account-trigger"
          aria-label="Open admin account"
        >
          <span className="avatar account-button" aria-hidden="true">
            {name.slice(0, 2).toUpperCase()}
          </span>
          <span className="account-name">{name}</span>
          <ChevronDown
            className="account-chevron"
            size={14}
            aria-hidden="true"
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="account-menu"
          align="end"
          sideOffset={10}
          collisionPadding={12}
        >
          <DropdownMenu.Label className="account-menu-heading">
            <span className="account-menu-avatar" aria-hidden="true">
              {name.slice(0, 2).toUpperCase()}
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
                    {roles.map((role) => role.replaceAll("_", " ")).join(", ")}
                  </strong>
                </div>
              )}
            </div>
          )}
          <DropdownMenu.Separator className="account-menu-separator" />
          <DropdownMenu.Item
            className="account-menu-signout"
            onSelect={onSignOut}
          >
            <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
