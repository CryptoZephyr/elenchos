"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export function ThreeHeroMotion() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    )
    camera.position.set(0, 0, 18)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
    scene.add(ambientLight)

    const dirLight1 = new THREE.DirectionalLight(0x1c7a74, 3.5)
    dirLight1.position.set(8, 12, 10)
    scene.add(dirLight1)

    const dirLight2 = new THREE.DirectionalLight(0x4ec7bc, 2.0)
    dirLight2.position.set(-8, -6, 6)
    scene.add(dirLight2)

    // 3. Materials
    const accentColor = new THREE.Color(0x1c7a74)
    const softColor = new THREE.Color(0x4ec7bc)
    const inkColor = new THREE.Color(0x0c1524)

    // 4. Objects Collection: 3D Floating Boxes and Moving Rings
    const animatedObjects: Array<{
      mesh: THREE.Object3D
      baseY: number
      speed: number
      rotSpeedX: number
      rotSpeedY: number
      rotSpeedZ: number
      amp: number
      phase: number
    }> = []

    const group = new THREE.Group()
    scene.add(group)

    // Create 3D Boxes (floating & bobbing)
    const boxConfigs = [
      {
        size: 1.8,
        pos: [-7.5, 2.2, -2],
        color: accentColor,
        speed: 1.2,
        amp: 0.6,
        phase: 0,
      },
      {
        size: 1.3,
        pos: [7.2, 2.8, -1],
        color: softColor,
        speed: 0.9,
        amp: 0.8,
        phase: 1.5,
      },
      {
        size: 1.0,
        pos: [-6.0, -3.2, 0],
        color: inkColor,
        speed: 1.4,
        amp: 0.5,
        phase: 3.0,
      },
      {
        size: 1.5,
        pos: [6.8, -2.6, -2],
        color: accentColor,
        speed: 1.1,
        amp: 0.7,
        phase: 4.2,
      },
      {
        size: 0.8,
        pos: [-3.8, 4.0, -3],
        color: softColor,
        speed: 1.6,
        amp: 0.4,
        phase: 2.1,
      },
      {
        size: 0.9,
        pos: [4.0, 3.8, -3],
        color: inkColor,
        speed: 1.3,
        amp: 0.5,
        phase: 5.0,
      },
    ]

    boxConfigs.forEach((cfg) => {
      const boxGeo = new THREE.BoxGeometry(cfg.size, cfg.size, cfg.size)
      const boxMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.25,
        metalness: 0.2,
        transparent: true,
        opacity: 0.75,
      })
      const boxMesh = new THREE.Mesh(boxGeo, boxMat)

      // Wireframe outline for technical look
      const edgesGeo = new THREE.EdgesGeometry(boxGeo)
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
      })
      const wireframe = new THREE.LineSegments(edgesGeo, edgesMat)
      boxMesh.add(wireframe)

      boxMesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2])
      group.add(boxMesh)

      animatedObjects.push({
        mesh: boxMesh,
        baseY: cfg.pos[1],
        speed: cfg.speed,
        rotSpeedX: 0.4 * cfg.speed,
        rotSpeedY: 0.6 * cfg.speed,
        rotSpeedZ: 0.2 * cfg.speed,
        amp: cfg.amp,
        phase: cfg.phase,
      })
    })

    // Create 3D Rings & Toruses (orbital moving circles)
    const ringConfigs = [
      {
        radius: 2.8,
        tube: 0.05,
        pos: [6.5, 0.5, -4],
        color: accentColor,
        speed: 0.8,
        amp: 0.6,
        phase: 0.5,
      },
      {
        radius: 4.2,
        tube: 0.04,
        pos: [-6.8, -0.5, -5],
        color: softColor,
        speed: 0.7,
        amp: 0.7,
        phase: 2.5,
      },
      {
        radius: 2.0,
        tube: 0.06,
        pos: [0, -3.8, -4],
        color: accentColor,
        speed: 1.0,
        amp: 0.5,
        phase: 4.0,
      },
      {
        radius: 5.5,
        tube: 0.03,
        pos: [0, 1.0, -8],
        color: softColor,
        speed: 0.5,
        amp: 0.9,
        phase: 1.0,
      },
    ]

    ringConfigs.forEach((cfg) => {
      const ringGeo = new THREE.TorusGeometry(cfg.radius, cfg.tube, 16, 64)
      const ringMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.3,
        metalness: 0.4,
        transparent: true,
        opacity: 0.65,
      })
      const ringMesh = new THREE.Mesh(ringGeo, ringMat)
      ringMesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2])
      ringMesh.rotation.x = Math.PI / 3
      group.add(ringMesh)

      animatedObjects.push({
        mesh: ringMesh,
        baseY: cfg.pos[1],
        speed: cfg.speed,
        rotSpeedX: 0.3 * cfg.speed,
        rotSpeedY: 0.5 * cfg.speed,
        rotSpeedZ: 0.2 * cfg.speed,
        amp: cfg.amp,
        phase: cfg.phase,
      })
    })

    // 5. Mouse & Touch Parallax
    let targetMouseX = 0
    let targetMouseY = 0
    let mouseX = 0
    let mouseY = 0

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      targetMouseX = x * 1.5
      targetMouseY = -y * 1.5
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0]
        const rect = container.getBoundingClientRect()
        const x = (touch.clientX - rect.left) / rect.width - 0.5
        const y = (touch.clientY - rect.top) / rect.height - 0.5
        targetMouseX = x * 1.5
        targetMouseY = -y * 1.5
      }
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("touchmove", onTouchMove, { passive: true })

    // 6. Resize Handler
    const onResize = () => {
      if (!container) return
      const width = container.clientWidth
      const height = container.clientHeight
      camera.aspect = width / height
      if (width < 640) {
        camera.position.z = 25
      } else if (width < 1024) {
        camera.position.z = 21
      } else {
        camera.position.z = 18
      }
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    onResize()
    window.addEventListener("resize", onResize)

    // 7. Animation Render Loop
    const startTime = performance.now()
    let animationFrameId: number

    const animate = () => {
      const elapsed = (performance.now() - startTime) * 0.001

      // Smooth mouse follow
      mouseX += (targetMouseX - mouseX) * 0.05
      mouseY += (targetMouseY - mouseY) * 0.05
      group.rotation.y = mouseX * 0.3
      group.rotation.x = mouseY * 0.2

      // Animate each box and ring
      animatedObjects.forEach((item) => {
        // Vertical harmonic bobbing
        item.mesh.position.y =
          item.baseY + Math.sin(elapsed * item.speed + item.phase) * item.amp

        // 3D rotation
        item.mesh.rotation.x += item.rotSpeedX * 0.02
        item.mesh.rotation.y += item.rotSpeedY * 0.02
        item.mesh.rotation.z += item.rotSpeedZ * 0.01
      })

      renderer.render(scene, camera)
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    // 8. Cleanup on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("resize", onResize)

      // Dispose scene resources
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material.dispose()
          }
        }
        if (child instanceof THREE.LineSegments) {
          child.geometry.dispose()
          child.material.dispose()
        }
      })

      renderer.dispose()
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden opacity-85"
      aria-hidden="true"
    />
  )
}
