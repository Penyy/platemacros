import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment, ContactShadows, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { LogEntry } from "@/lib/store";

const PLATE_URL = "https://cdn.jsdelivr.net/gh/Penyy/plate-models@main/plate.glb";
const APPLE_URL = "https://cdn.jsdelivr.net/gh/Penyy/plate-models@main/apple.glb";

useGLTF.preload(PLATE_URL);
useGLTF.preload(APPLE_URL);

const PLATE_DIAMETER = 4;
const APPLE_HEIGHT = 0.7;

function PlateModel({ onTopY }: { onTopY: (y: number) => void }) {
  const { scene } = useGLTF(PLATE_URL);
  const prepared = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    // Center to origin
    root.position.sub(center);
    // Scale so the largest horizontal dimension (diameter) = PLATE_DIAMETER
    const maxXZ = Math.max(size.x, size.z);
    const scale = maxXZ > 0 ? PLATE_DIAMETER / maxXZ : 1;
    root.scale.setScalar(scale);
    // After scaling, lift so bottom sits at y=0
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y -= box2.min.y;
    const finalBox = new THREE.Box3().setFromObject(root);
    return { root, topY: finalBox.max.y };
  }, [scene]);

  useEffect(() => {
    onTopY(prepared.topY);
  }, [prepared.topY, onTopY]);

  // Enable shadows on meshes
  useEffect(() => {
    prepared.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).castShadow = true;
        (obj as THREE.Mesh).receiveShadow = true;
      }
    });
  }, [prepared]);

  return <primitive object={prepared.root} />;
}

function AppleModel({ surfaceY }: { surfaceY: number }) {
  const { scene, nodes } = useGLTF(APPLE_URL);

  const prepared = useMemo(() => {
    // Log node names to help identify the whole apple
    // eslint-disable-next-line no-console
    console.log("apple.glb nodes:", Object.keys(nodes));

    const cloned = scene.clone(true);

    // Find candidate meshes
    const meshes: THREE.Mesh[] = [];
    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
    });

    // Try to find a whole apple by name keywords
    const wholeKeywords = ["whole", "full", "apple_full", "apple1", "apple_1", "complete"];
    const sliceKeywords = ["half", "slice", "quarter", "piece", "cut", "wedge", "segment"];

    let wholeMeshes: THREE.Mesh[] = meshes.filter((m) => {
      const n = m.name.toLowerCase();
      return wholeKeywords.some((k) => n.includes(k));
    });

    if (wholeMeshes.length === 0) {
      // Exclude obvious slice/half meshes
      const nonSlice = meshes.filter((m) => {
        const n = m.name.toLowerCase();
        return !sliceKeywords.some((k) => n.includes(k));
      });
      // Pick the largest contiguous mesh (by bounding box volume)
      const candidates = nonSlice.length > 0 ? nonSlice : meshes;
      let best: THREE.Mesh | null = null;
      let bestVol = -1;
      for (const m of candidates) {
        const b = new THREE.Box3().setFromObject(m);
        const s = new THREE.Vector3();
        b.getSize(s);
        const vol = s.x * s.y * s.z;
        if (vol > bestVol) {
          bestVol = vol;
          best = m;
        }
      }
      if (best) wholeMeshes = [best];
    }

    const wholeSet = new Set(wholeMeshes);
    // Hide every other mesh
    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.visible = wholeSet.has(m);
        if (m.visible) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      }
    });

    // Wrap visible meshes in a group so we can normalize transform
    const group = new THREE.Group();
    // Compute bbox over visible parts
    const box = new THREE.Box3();
    let hasAny = false;
    wholeMeshes.forEach((m) => {
      const b = new THREE.Box3().setFromObject(m);
      if (!hasAny) {
        box.copy(b);
        hasAny = true;
      } else {
        box.union(b);
      }
    });

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Move the whole cloned scene so bbox center is at origin
    cloned.position.sub(center);
    group.add(cloned);

    const scale = size.y > 0 ? APPLE_HEIGHT / size.y : 1;
    group.scale.setScalar(scale);

    // After scaling, lift so apple bottom rests at surfaceY
    return { group, scale };
  }, [scene, nodes]);

  // Position: bottom on surfaceY
  // After centering & scaling, bbox bottom = -size.y/2 * scale = -APPLE_HEIGHT/2
  prepared.group.position.set(0, surfaceY + APPLE_HEIGHT / 2, 0);

  return <primitive object={prepared.group} />;
}

interface Props {
  entries: LogEntry[];
  dayKey: string;
  remainingKcal: number;
  goalKcal: number;
  consumedKcal: number;
}

export function Plate3D({
  entries,
  remainingKcal,
  goalKcal,
  consumedKcal,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [plateTopY, setPlateTopY] = useState(0.2);
  useEffect(() => setMounted(true), []);

  const over = remainingKcal < 0;
  const hasFood = entries.length > 0;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="h-[320px] w-full">
        {mounted && (
          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{ alpha: true, antialias: true }}
          >
            <PerspectiveCamera makeDefault fov={35} position={[0, 3, 4.2]} />
            <ambientLight intensity={0.6} />
            <directionalLight
              position={[4, 8, 5]}
              intensity={1.2}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <Suspense fallback={null}>
              <Environment preset="studio" />
              <PlateModel onTopY={setPlateTopY} />
              {hasFood && <AppleModel surfaceY={plateTopY} />}
              <ContactShadows
                position={[0, 0, 0]}
                opacity={0.35}
                blur={2.5}
                scale={10}
              />
            </Suspense>
            <OrbitControls
              target={[0, 0.2, 0]}
              enablePan={false}
              enableZoom={false}
              autoRotate
              autoRotateSpeed={0.5}
              minDistance={3}
              maxDistance={7}
            />
          </Canvas>
        )}
      </div>
      <div className="mt-2 flex flex-col items-center pointer-events-none">
        <div
          className={`num-tight text-5xl font-bold ${
            over ? "text-[color:var(--protein)]" : ""
          }`}
        >
          {over
            ? `+${Math.abs(Math.round(remainingKcal))}`
            : Math.round(remainingKcal)}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {over ? "ponad cel" : "pozostało"}
        </div>
        <div className="num-tight mt-1 text-[11px] text-muted-foreground">
          {Math.round(consumedKcal)} / {goalKcal} kcal
        </div>
      </div>
    </div>
  );
}
