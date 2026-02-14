"use client"

import { useState, useCallback } from "react"
import { Toolbar } from "@/components/paint/toolbar"
import { Canvas } from "@/components/paint/canvas"
import { Paintbrush } from "lucide-react"

export default function Page() {
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil")
  const [color, setColor] = useState("#1a1a2e")
  const [brushSize, setBrushSize] = useState(4)
  const [clearSignal, setClearSignal] = useState(0)
  const [userCount, setUserCount] = useState(0)

  const handleClear = () => {
    setClearSignal((prev) => prev + 1)
  }

  const handleUserCountChange = useCallback((count: number) => {
    setUserCount(count)
  }, [])

  return (
    <main className="flex h-dvh flex-col bg-muted p-3 gap-3">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Paintbrush className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            Paint Together
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Draw something -- everyone can see it
        </p>
      </header>

      {/* Toolbar */}
      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        onClear={handleClear}
        userCount={userCount}
      />

      {/* Canvas */}
      <Canvas
        tool={tool}
        color={color}
        brushSize={brushSize}
        clearSignal={clearSignal}
        onUserCountChange={handleUserCountChange}
      />
    </main>
  )
}
