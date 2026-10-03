import {
  Bot,
  Clapperboard,
  Globe2,
  LayoutGrid,
  Layers,
  Rocket,
  Palette,
  Video,
  Gamepad2,
  Megaphone,
  Sparkles,
  Code2,
  Camera,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export type Board = string;

export const BOARD_ICONS: Record<string, LucideIcon> = {
  LayoutGrid,
  Clapperboard,
  Globe2,
  Bot,
  Layers,
  Rocket,
  Palette,
  Video,
  Gamepad2,
  Megaphone,
  Sparkles,
  Code2,
  Camera,
  ShoppingCart,
};

export const BOARD_ICON_NAMES = Object.keys(BOARD_ICONS);

export const boardIcon = (name?: string | null): LucideIcon =>
  (name && BOARD_ICONS[name]) || LayoutGrid;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
