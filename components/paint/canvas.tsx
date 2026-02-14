"use client"

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type PointerEvent,
} from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface Stroke {
  points: { x: number; y: number }[]
  color: string
  size: number
  tool: "pencil" | "eraser"
}

interface CanvasProps {
  tool: "pencil" | "eraser"
  color: string
  brushSize: number
  clearSignal: number
  onUserCountChange: (count: number) => void
}

const CHANNEL_NAME = "paint-room"

export function Canvas({
  tool,
  color,
  brushSize,
  clearSignal,
  onUserCountChange,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)
  const currentStroke = useRef<Stroke | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const allStrokes = useRef<Stroke[]>([])
  const myIdRef = useRef(crypto.randomUUID())
  const hasSyncedRef = useRef(false)
  const [isConnected, setIsConnected] = useState(false)

  // Draw a single stroke on the canvas
  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length < 2) return
      ctx.save()
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.lineWidth = stroke.size

      if (stroke.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out"
        ctx.strokeStyle = "rgba(0,0,0,1)"
      } else {
        ctx.globalCompositeOperation = "source-over"
        ctx.strokeStyle = stroke.color
      }

      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)

      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1]
        const curr = stroke.points[i]
        const midX = (prev.x + curr.x) / 2
        const midY = (prev.y + curr.y) / 2
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY)
      }

      const last = stroke.points[stroke.points.length - 1]
      ctx.lineTo(last.x, last.y)
      ctx.stroke()
      ctx.restore()
    },
    []
  )

  // Redraw all strokes
  const redrawAll = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      for (const stroke of allStrokes.current) {
        drawStroke(ctx, stroke)
      }
    },
    [drawStroke]
  )

  // Resize canvas to fill container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(dpr, dpr)
      redrawAll(ctx)
    }
  }, [redrawAll])

  // Handle clear signal
  useEffect(() => {
    if (clearSignal === 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    allStrokes.current = []
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Broadcast clear
    channelRef.current?.send({
      type: "broadcast",
      event: "clear",
      payload: {},
    })
  }, [clearSignal])

  // Setup Supabase Realtime channel
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: { key: myIdRef.current },
        broadcast: { self: false },
      },
    })

    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const stroke = payload as Stroke
        allStrokes.current.push(stroke)
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (ctx) drawStroke(ctx, stroke)
      })
      .on("broadcast", { event: "drawing" }, ({ payload }) => {
        // Draw incremental points from other users in real-time
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const { points, color: strokeColor, size, tool: strokeTool } = payload as {
          points: { x: number; y: number }[]
          color: string
          size: number
          tool: "pencil" | "eraser"
        }
        if (points.length < 2) return

        ctx.save()
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.lineWidth = size
        if (strokeTool === "eraser") {
          ctx.globalCompositeOperation = "destination-out"
          ctx.strokeStyle = "rgba(0,0,0,1)"
        } else {
          ctx.globalCompositeOperation = "source-over"
          ctx.strokeStyle = strokeColor
        }
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        ctx.lineTo(points[1].x, points[1].y)
        ctx.stroke()
        ctx.restore()
      })
      .on("broadcast", { event: "sync-request" }, ({ payload }) => {
        // Another user is requesting the current canvas state
        const requesterId = payload?.requesterId
        if (requesterId === myIdRef.current) return // ignore own request

        const canvas = canvasRef.current
        if (!canvas) return

        // Only respond if we have content (strokes drawn)
        if (allStrokes.current.length === 0) return

        // Add a small random delay so not everyone responds at once
        const delay = Math.random() * 300
        setTimeout(() => {
          try {
            const dataUrl = canvas.toDataURL("image/png")
            const strokes = allStrokes.current
            channelRef.current?.send({
              type: "broadcast",
              event: "sync-response",
              payload: {
                targetId: requesterId,
                imageData: dataUrl,
                strokes,
              },
            })
          } catch {
            // Canvas might be tainted or too large, ignore
          }
        }, delay)
      })
      .on("broadcast", { event: "sync-response" }, ({ payload }) => {
        // We received a canvas snapshot from an existing user
        const { targetId, imageData, strokes } = payload as {
          targetId: string
          imageData: string
          strokes: Stroke[]
        }

        // Only accept if meant for us and we haven't synced yet
        if (targetId !== myIdRef.current || hasSyncedRef.current) return
        hasSyncedRef.current = true

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        // Load the image and draw it onto the canvas
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.save()
          const dpr = window.devicePixelRatio || 1
          ctx.scale(1 / dpr, 1 / dpr)
          ctx.drawImage(img, 0, 0)
          ctx.restore()
          // Sync the stroke history so we can respond to future sync requests
          if (strokes && strokes.length > 0) {
            allStrokes.current = [...strokes]
          }
        }
        img.src = imageData
      })
      .on("broadcast", { event: "clear" }, () => {
        allStrokes.current = []
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const count = Object.keys(state).length
        onUserCountChange(count)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true)
          await channel.track({ online_at: new Date().toISOString() })

          // Request canvas state from existing users
          setTimeout(() => {
            if (!hasSyncedRef.current) {
              channel.send({
                type: "broadcast",
                event: "sync-request",
                payload: { requesterId: myIdRef.current },
              })
            }
          }, 500)
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [drawStroke, onUserCountChange])

  // Setup resize observer
  useEffect(() => {
    resizeCanvas()
    const handleResize = () => resizeCanvas()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [resizeCanvas])

  const getCanvasPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)

    isDrawing.current = true
    const point = getCanvasPoint(e)
    currentStroke.current = {
      points: [point],
      color,
      size: brushSize,
      tool,
    }
  }

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !currentStroke.current) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const point = getCanvasPoint(e)
    const prev = currentStroke.current.points[currentStroke.current.points.length - 1]
    currentStroke.current.points.push(point)

    // Draw locally
    ctx.save()
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = currentStroke.current.size

    if (currentStroke.current.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out"
      ctx.strokeStyle = "rgba(0,0,0,1)"
    } else {
      ctx.globalCompositeOperation = "source-over"
      ctx.strokeStyle = currentStroke.current.color
    }

    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    ctx.restore()

    // Broadcast incremental drawing
    channelRef.current?.send({
      type: "broadcast",
      event: "drawing",
      payload: {
        points: [prev, point],
        color: currentStroke.current.color,
        size: currentStroke.current.size,
        tool: currentStroke.current.tool,
      },
    })
  }

  const handlePointerUp = () => {
    if (!isDrawing.current || !currentStroke.current) return
    isDrawing.current = false

    // Save completed stroke
    if (currentStroke.current.points.length > 1) {
      allStrokes.current.push(currentStroke.current)

      // Broadcast completed stroke
      channelRef.current?.send({
        type: "broadcast",
        event: "stroke",
        payload: currentStroke.current,
      })
    }

    currentStroke.current = null
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Connecting...
          </div>
        </div>
      )}
    </div>
  )
}
