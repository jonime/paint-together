"use client"

import { cn } from "@/lib/utils"
import {
  Pencil,
  Eraser,
  Trash2,
  Minus,
  Plus,
  Users,
  Circle,
} from "lucide-react"

const COLORS = [
  "#1a1a2e",
  "#e94560",
  "#0f3460",
  "#16213e",
  "#53d8fb",
  "#e7305b",
  "#f38181",
  "#fce38a",
  "#95e1d3",
  "#3a506b",
  "#f5f5f5",
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#f9ca24",
  "#6c5ce7",
]

interface ToolbarProps {
  tool: "pencil" | "eraser"
  setTool: (tool: "pencil" | "eraser") => void
  color: string
  setColor: (color: string) => void
  brushSize: number
  setBrushSize: (size: number) => void
  onClear: () => void
  userCount: number
}

export function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  brushSize,
  setBrushSize,
  onClear,
  userCount,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      {/* Tools */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setTool("pencil")}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            tool === "pencil"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
          aria-label="Pencil tool"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            tool === "eraser"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
          aria-label="Eraser tool"
        >
          <Eraser className="h-4 w-4" />
        </button>
      </div>

      <div className="mx-2 h-6 w-px bg-border" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c)
              setTool("pencil")
            }}
            className={cn(
              "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
              color === c && tool === "pencil"
                ? "border-foreground scale-110"
                : "border-transparent"
            )}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      <div className="mx-2 h-6 w-px bg-border" />

      {/* Brush Size */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setBrushSize(Math.max(1, brushSize - 2))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Decrease brush size"
        >
          <Minus className="h-3 w-3" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center">
          <Circle
            className="text-foreground"
            style={{
              width: Math.max(6, Math.min(brushSize, 24)),
              height: Math.max(6, Math.min(brushSize, 24)),
            }}
            fill="currentColor"
          />
        </div>
        <button
          onClick={() => setBrushSize(Math.min(40, brushSize + 2))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Increase brush size"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="mx-2 h-6 w-px bg-border" />

      {/* Clear */}
      <button
        onClick={onClear}
        className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        aria-label="Clear canvas"
      >
        <Trash2 className="h-4 w-4" />
        <span className="hidden sm:inline">Clear</span>
      </button>

      <div className="flex-1" />

      {/* User count */}
      <div className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground">
        <Users className="h-4 w-4" />
        <span className="font-medium">{userCount}</span>
        <span className="hidden sm:inline text-muted-foreground">online</span>
      </div>
    </div>
  )
}
