import { useEffect, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";

const PLATE_URL = "https://cdn.jsdelivr.net/gh/Penyy/plate-models@main/plate.glb";
const APPLE_URL = "https://cdn.jsdelivr.net/gh/Penyy/plate-models@main/apple.glb";

useGLTF.preload(PLATE_URL);
useGLTF.preload(APPLE_URL);

function PlateModel() {
  const { scene } = useGLTF(PLATE_URL);
  return <primitive object={scene} position={[0, 0, 0]} />;
}

function AppleModel() {
  const { scene } = useGLTF(APPLE_URL);
  return <primitive object={scene.clone()} position={[0, 0.5, 0]} scale={0.5} />;
}

export function GLBTest() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-[320px] w-full" />;
  return (
    <div className="h-[320px] w-full rounded-2xl bg-card/60">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 2.6, 3.4], fov: 38 }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[2.5, 5, 3]} intensity={1.2} castShadow />
        <Suspense fallback={null}>
          <PlateModel />
          <AppleModel />
        </Suspense>
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  );
}
