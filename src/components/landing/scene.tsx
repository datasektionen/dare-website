import { useEffect, useRef, useState } from "react"
import { SceneRenderer } from "./scene-renderer"

/**
 * Animated night-time Åre landscape on a canvas that fills its parent. Fades
 * in once the landscape has been pre-rendered.
 */
export function Scene({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new SceneRenderer(canvas, {
      onReady: () => setReady(true),
      animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    })
    renderer.start()
    return () => renderer.destroy()
  }, [])

  return (
    <div className={className}>
      <div className="absolute inset-0 overflow-hidden bg-[#050a22]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block size-full transition-opacity duration-700"
          style={{ opacity: ready ? 1 : 0 }}
        />
      </div>
    </div>
  )
}
