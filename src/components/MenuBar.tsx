import { useCallback, useEffect, useRef, useState } from "react";

import { getCommand, runCommand } from "../app/commands";
import { MENUS } from "../app/menus";
import type { MenuItem } from "../app/menus";
import { formatShortcut } from "../app/shortcuts";
import { openPath } from "../features/files/fileActions";
import { useSettings } from "../stores/settingsStore";
import { basename } from "../utils/path";

interface ItemsProps {
  items: MenuItem[];
  onDone: () => void;
}

function MenuItems({ items, onDone }: ItemsProps) {
  const recentFiles = useSettings((s) => s.recentFiles);
  const clearRecent = useSettings((s) => s.clearRecent);

  return (
    <>
      {items.map((item, index) => {
        if (item.type === "separator")
          return <div key={index} className="menu-separator" role="separator" />;
        if (item.type === "submenu") {
          return (
            <div key={index} className="menu-submenu" role="none">
              <button type="button" className="menu-item" role="menuitem" aria-haspopup="menu">
                <span className="menu-check" />
                <span className="menu-label">{item.label}</span>
                <span className="menu-arrow">›</span>
              </button>
              <div className="menu-dropdown menu-dropdown-sub" role="menu">
                <MenuItems items={item.items} onDone={onDone} />
              </div>
            </div>
          );
        }
        if (item.type === "recent") {
          return (
            <div key={index} className="menu-submenu" role="none">
              <button type="button" className="menu-item" role="menuitem" aria-haspopup="menu">
                <span className="menu-check" />
                <span className="menu-label">Open Recent</span>
                <span className="menu-arrow">›</span>
              </button>
              <div className="menu-dropdown menu-dropdown-sub" role="menu">
                {recentFiles.length === 0 && <div className="menu-empty">No recent files</div>}
                {recentFiles.map((path) => (
                  <button
                    key={path}
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    title={path}
                    onClick={() => {
                      onDone();
                      void openPath(path);
                    }}
                  >
                    <span className="menu-check" />
                    <span className="menu-label">{basename(path)}</span>
                    <span className="menu-shortcut menu-path">{path}</span>
                  </button>
                ))}
                {recentFiles.length > 0 && (
                  <>
                    <div className="menu-separator" role="separator" />
                    <button
                      type="button"
                      className="menu-item"
                      role="menuitem"
                      onClick={() => {
                        onDone();
                        clearRecent();
                      }}
                    >
                      <span className="menu-check" />
                      <span className="menu-label">Clear Recent Files</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        }
        const command = getCommand(item.command);
        const enabled = command.enabled ? command.enabled() : true;
        const checked = command.checked?.();
        return (
          <button
            key={index}
            type="button"
            className="menu-item"
            role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
            aria-checked={checked === undefined ? undefined : checked}
            disabled={!enabled}
            onClick={() => {
              onDone();
              runCommand(command.id);
            }}
          >
            <span className="menu-check">{checked ? "✓" : ""}</span>
            <span className="menu-label">{command.label}</span>
            {command.shortcut && (
              <span className="menu-shortcut">{formatShortcut(command.shortcut)}</span>
            )}
          </button>
        );
      })}
    </>
  );
}

export function MenuBar() {
  const [open, setOpen] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (open === null) return;
    const onPointer = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setOpen((o) => (o === null ? o : (o + 1) % MENUS.length));
      if (event.key === "ArrowLeft")
        setOpen((o) => (o === null ? o : (o - 1 + MENUS.length) % MENUS.length));
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Focus the first item when a menu opens via keyboard or click.
  useEffect(() => {
    if (open === null) return;
    const first = barRef.current?.querySelector<HTMLButtonElement>(
      ".menu-dropdown button:not(:disabled)",
    );
    first?.focus({ preventScroll: true });
  }, [open]);

  return (
    <div className="menubar" role="menubar" ref={barRef} aria-label="Application menu">
      {MENUS.map((menu, index) => (
        <div key={menu.label} className="menubar-entry">
          <button
            type="button"
            className={`menubar-button${open === index ? " is-open" : ""}`}
            aria-haspopup="menu"
            aria-expanded={open === index}
            onMouseDown={(event) => {
              event.preventDefault();
              setOpen(open === index ? null : index);
            }}
            onMouseEnter={() => open !== null && setOpen(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(index);
              }
            }}
          >
            {menu.label}
          </button>
          {open === index && (
            <div
              className="menu-dropdown"
              role="menu"
              aria-label={menu.label}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                event.preventDefault();
                const buttons = [
                  ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    ":scope > button:not(:disabled), :scope > .menu-submenu > button",
                  ),
                ];
                const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
                const step = event.key === "ArrowDown" ? 1 : -1;
                buttons[(current + step + buttons.length) % buttons.length]?.focus();
              }}
            >
              <MenuItems items={menu.items} onDone={close} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
