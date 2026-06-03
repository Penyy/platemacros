import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  useGLTF,
  OrbitControls,
  Environment,
  ContactShadows,
  PerspectiveCamera,
} from "@react-three/drei";
import { useSpring, animated, config } from "@react-spring/three";
import * as THREE from "three";
import type { LogEntry } from "@/lib/store";

const PLATE_URL = "https://cdn.jsdelivr.net/gh/Penyy/plate-models@main/plate.glb";
const APPLE_URL = "https://cdn.jsdelivr.net/gh/Penyy/plate-models@main/apple.glb";

useGLTF.preload(PLATE_URL);
useGLTF.preload(APPLE_URL);

const PLATE_DIAMETER = 3.0;
const APPLE_HEIGHT = 0.7;
const PLATE_RADIUS = PLATE_DIAMETER / 2;

/* ---------- Plate ---------- */

function PlateModel({ onTopY }: { onTopY: (y: number) => void }) {
  const { scene } = useGLTF(PLATE_URL);
  const prepared = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    root.position.sub(center);
    const maxXZ = Math.max(size.x, size.z);
    const scale = maxXZ > 0 ? PLATE_DIAMETER / maxXZ : 1;
    root.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y -= box2.min.y;
    const finalBox = new THREE.Box3().setFromObject(root);
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).castShadow = true;
        (obj as THREE.Mesh).receiveShadow = true;
      }
    });
    return { root, topY: finalBox.max.y };
  }, [scene]);

  useEffect(() => {
    onTopY(prepared.topY);
  }, [prepared.topY, onTopY]);

  return <primitive object={prepared.root} />;
}

/* ---------- Apple variants ---------- */

type AppleVariantKind = "whole" | "half" | "slice";

interface AppleVariant {
  name: string;
  kind: AppleVariantKind;
  /** A reusable Object3D template (already normalized to APPLE_HEIGHT, bottom at y=0). */
  template: THREE.Object3D;
}

function buildVariants(scene: THREE.Object3D, nodes: Record<string, THREE.Object3D>) {
  // eslint-disable-next-line no-console
  console.log("apple.glb nodes:", Object.keys(nodes));

  const meshes: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
  });

  const classify = (n: string): AppleVariantKind => {
    const s = n.toLowerCase();
    if (/(slice|wedge|segment|piece|cut)/.test(s)) return "slice";
    if (/(half|halve)/.test(s)) return "half";
    return "whole";
  };

  const variants: AppleVariant[] = [];

  for (const mesh of meshes) {
    const clone = mesh.clone(true);
    clone.visible = true;
    const wrapper = new THREE.Group();
    wrapper.add(clone);

    // Normalize: center on origin, scale to height = APPLE_HEIGHT, sit on y=0
    const box = new THREE.Box3().setFromObject(wrapper);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    if (size.y <= 0.0001) continue;

    clone.position.sub(center);
    const scale = APPLE_HEIGHT / size.y;
    wrapper.scale.setScalar(scale);

    const box2 = new THREE.Box3().setFromObject(wrapper);
    wrapper.position.y -= box2.min.y;

    wrapper.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).castShadow = true;
        (obj as THREE.Mesh).receiveShadow = true;
      }
    });

    variants.push({
      name: mesh.name || `mesh_${variants.length}`,
      kind: classify(mesh.name || ""),
      template: wrapper,
    });
  }

  return variants;
}

/* ---------- Apple instance with spring ---------- */

interface AppleInstanceProps {
  variant: AppleVariant;
  position: [number, number, number];
  rotation: [number, number, number];
  onExited: () => void;
  exiting: boolean;
}

function AppleInstance({
  variant,
  position,
  rotation,
  onExited,
  exiting,
}: AppleInstanceProps) {
  const object = useMemo(() => variant.template.clone(true), [variant]);

  const { s, lift } = useSpring({
    from: { s: 0, lift: 0.35 },
    to: exiting
      ? { s: 0, lift: 0.4 }
      : { s: 1, lift: 0 },
    config: exiting
      ? { tension: 220, friction: 22, mass: 0.6 }
      : { tension: 260, friction: 14, mass: 0.7 }, // overshoot ~1.12
    onRest: () => {
      if (exiting) onExited();
    },
  });

  return (
    <animated.group
      position-x={position[0]}
      position-z={position[2]}
      position-y={lift.to((l) => position[1] + l)}
      rotation={rotation}
      scale={s}
    >
      <primitive object={object} />
    </animated.group>
  );
}

/* ---------- Slot generation ---------- */

// Five on-plate slots within radius ~1.0 of plate center
const ON_PLATE_SLOTS: Array<[number, number]> = [
  [0, 0],
  [0.85, 0],
  [-0.85, 0],
  [0, 0.85],
  [0, -0.85],
];

// Off-plate "spilled" positions (lying flat on surface y=0, outside plate radius)
const OFF_PLATE_SLOTS: Array<[number, number]> = [
  [1.9, 0.5],
  [-1.9, -0.4],
  [1.7, -1.5],
  [-1.7, 1.4],
  [2.1, -0.7],
  [-2.1, 0.8],
];

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

interface PlannedApple {
  id: string;
  variant: AppleVariant;
  position: [number, number, number];
  rotation: [number, number, number];
}

function planApples(
  count: number,
  variants: AppleVariant[],
  plateTopY: number,
  dayKey: string,
): PlannedApple[] {
  if (variants.length === 0) return [];
  const wholes = variants.filter((v) => v.kind === "whole");
  const halves = variants.filter((v) => v.kind === "half");
  const slices = variants.filter((v) => v.kind === "slice");
  const cut = [...halves, ...slices];
  const pickWhole = (rand: () => number) =>
    wholes.length ? wholes[Math.floor(rand() * wholes.length)] : variants[0];
  const pickCut = (rand: () => number) =>
    cut.length ? cut[Math.floor(rand() * cut.length)] : pickWhole(rand);

  // Stable seed per day, but reused across renders so positions don't jitter
  const seedBase = Array.from(dayKey).reduce((a, c) => a + c.charCodeAt(0), 0);

  const planned: PlannedApple[] = [];
  const max = Math.min(count, ON_PLATE_SLOTS.length + OFF_PLATE_SLOTS.length);

  for (let i = 0; i < max; i++) {
    const rand = seededRand(seedBase * 1000 + i * 97 + 13);
    if (i < ON_PLATE_SLOTS.length) {
      const [sx, sz] = ON_PLATE_SLOTS[i];
      const rotY = rand() * Math.PI * 2;
      const variant = pickWhole(rand);
      planned.push({
        id: `on-${i}`,
        variant,
        position: [sx, plateTopY, sz],
        rotation: [0, rotY, 0],
      });
    } else {
      const off = OFF_PLATE_SLOTS[(i - ON_PLATE_SLOTS.length) % OFF_PLATE_SLOTS.length];
      const x = off[0];
      const z = off[1];
      // toppled on side -> rotate ~PI/2 on X (axis chosen via rand)
      const onX = rand() < 0.5;
      const rotX = onX ? Math.PI / 2 : 0;
      const rotZ = onX ? 0 : Math.PI / 2;
      const rotY = rand() * Math.PI * 2;
      const variant = pickWhole(rand);
      planned.push({
        id: `off-${i}`,
        variant,
        position: [x, APPLE_HEIGHT / 2, z],
        rotation: [rotX, rotY, rotZ],
      });
    }
  }

  return planned;
}

/* ---------- Apples wrapper that handles enter/exit ---------- */

function ApplesLayer({
  count,
  plateTopY,
  dayKey,
}: {
  count: number;
  plateTopY: number;
  dayKey: string;
}) {
  const { scene, nodes } = useGLTF(APPLE_URL) as unknown as {
    scene: THREE.Object3D;
    nodes: Record<string, THREE.Object3D>;
  };
  const variants = useMemo(() => buildVariants(scene, nodes), [scene, nodes]);

  const planned = useMemo(
    () => planApples(count, variants, plateTopY, dayKey),
    [count, variants, plateTopY, dayKey],
  );

  // Track which ids are currently mounted (so we can animate out removed ones)
  const [exiting, setExiting] = useState<Map<string, PlannedApple>>(new Map());
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nextIds = new Set(planned.map((p) => p.id));
    const prev = prevIdsRef.current;
    const removed: PlannedApple[] = [];
    // Find ids that were present before but no longer present
    // We need their old plan to render them while exiting
    prev.forEach((id) => {
      if (!nextIds.has(id)) {
        const old = exitingPlanRef.current.get(id);
        if (old) removed.push(old);
      }
    });
    prevIdsRef.current = nextIds;
    // Save current plan for future removals
    planned.forEach((p) => exitingPlanRef.current.set(p.id, p));

    if (removed.length > 0) {
      setExiting((m) => {
        const next = new Map(m);
        removed.forEach((r) => next.set(r.id, r));
        return next;
      });
    }
    // Drop exiting entries that are now back in the plan
    setExiting((m) => {
      if (m.size === 0) return m;
      let changed = false;
      const next = new Map(m);
      m.forEach((_v, id) => {
        if (nextIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : m;
    });
  }, [planned]);

  const exitingPlanRef = useRef<Map<string, PlannedApple>>(new Map());

  return (
    <>
      {planned.map((p) => (
        <AppleInstance
          key={p.id}
          variant={p.variant}
          position={p.position}
          rotation={p.rotation}
          exiting={false}
          onExited={() => {}}
        />
      ))}
      {Array.from(exiting.values()).map((p) => (
        <AppleInstance
          key={`exit-${p.id}`}
          variant={p.variant}
          position={p.position}
          rotation={p.rotation}
          exiting
          onExited={() =>
            setExiting((m) => {
              if (!m.has(p.id)) return m;
              const next = new Map(m);
              next.delete(p.id);
              return next;
            })
          }
        />
      ))}
    </>
  );
}

/* ---------- Main component ---------- */

interface Props {
  entries: LogEntry[];
  dayKey: string;
  remainingKcal: number;
  goalKcal: number;
  consumedKcal: number;
}

export function Plate3D({
  entries,
  dayKey,
  remainingKcal,
  goalKcal,
  consumedKcal,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [plateTopY, setPlateTopY] = useState(0.2);
  useEffect(() => setMounted(true), []);

  const over = remainingKcal < 0;
  const hasFood = entries.length > 0;

  const unit = goalKcal > 0 ? goalKcal / 5 : 0;
  const appleCount = hasFood && unit > 0 ? Math.min(8, Math.floor(consumedKcal / unit)) : 0;

  const polar = Math.PI * 0.32;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="h-[320px] w-full">
        {mounted && (
          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{ alpha: true, antialias: true }}
          >
            <PerspectiveCamera makeDefault fov={32} position={[0, 3.3, 5.2]} />
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
              {appleCount > 0 && (
                <ApplesLayer
                  count={appleCount}
                  plateTopY={plateTopY}
                  dayKey={dayKey}
                />
              )}
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
              autoRotateSpeed={0.4}
              minPolarAngle={polar}
              maxPolarAngle={polar}
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

// Avoid unused-import warning for `config`
void config;
// Keep PLATE_RADIUS referenced for potential future bounds checks
void PLATE_RADIUS;
