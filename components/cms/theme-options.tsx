"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { DropdownMenu } from "radix-ui";

const themes = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function ThemeOptions() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <DropdownMenu.Separator className="account-menu-separator" />
      <DropdownMenu.Label className="theme-menu-label">
        Appearance
      </DropdownMenu.Label>
      <DropdownMenu.RadioGroup
        value={theme}
        onValueChange={setTheme}
        className="theme-menu-options"
      >
        {themes.map(({ value, label, Icon }) => (
          <DropdownMenu.RadioItem
            key={value}
            value={value}
            onSelect={(event) => event.preventDefault()}
            className="theme-menu-item"
          >
            <Icon size={15} aria-hidden="true" />
            <span>{label}</span>
            <DropdownMenu.ItemIndicator className="theme-menu-check">
              <Check size={15} aria-hidden="true" />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </>
  );
}
