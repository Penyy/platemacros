import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LogEntry } from "@/lib/store";

type Shape = "protein" | "carbs" | "fat";

interface FoodItem {
  id: string;
  shape: Shape;
  color: string;
  x: number;
  z: number;
  y: number;
  vy: number;
  rest: boolean;
  bornAt: number;
  rot: [number, number, number];
}

const COLORS: Record<Shape, string> = {
  protein: "#FF375F",
  carbs: "#FF9F0A",
  fat: "#BF5AF2",
};

function dominant(e: LogEntry): Shape {
  const p = e.protein * 4;
  const c = e.carbs * 4;
  const f = e.fat * 9;
  const max = Math.max(p, c, f);
  if (max === 0) {
    const arr: Shape[] = ["protein", "carbs", "fat"];
    return arr[Math.floor(Math.random() * 3)];
  }
  if (max === p) return "protein";
  if (max === c) return "carbs";
  return "fat";
}

function FoodMesh({ item, opacity }: { item: FoodItem; opacity: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    if (!item.rest) {
      item.vy += 0.015;
      item.y -= item.vy;
      if (item.y <= 0.22) {
        item.y = 0.22;
        item.vy *= -0.3;
        if (Math.abs(item.vy) < 0.04) {
          item.rest = true;
          item.vy = 0;
        }
      }
    }
    ref.current.position.set(item.x, item.y, item.z);
  });

  const geom =
    item.shape === "carbs" ? (
      <boxGeometry args={[0.34, 0.34, 0.34]} />
    ) : item.shape === "fat" ? (
      <sphereGeometry args={[0.15, 24, 24]} />
    ) : (
      <sphereGeometry args={[0.21, 24, 24]} />
    );

  return (
    <mesh ref={ref} rotation={item.rot} castShadow>
      {geom}
      <meshStandardMaterial
        color={item.color}
        roughness={0.45}
        metalness={0.05}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

function Plate({ fillPct }: { fillPct: number }) {
  const fillColor = useMemo(() => {
    const a = new THREE.Color("#fff5dc");
    const b = new THREE.Color("#d4a347");
    return a.clone().lerp(b, Math.min(1, fillPct));
  }, [fillPct]);
  const fillOpacity = Math.min(0.85, fillPct * 0.85);
  return (
    <group>
      {/* Plate body */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[1.8, 1.7, 0.12, 72]} />
        <meshStandardMaterial color="#fafafa" roughness={0.25} metalness={0.05} />
      </mesh>
      {/* Raised rim */}
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.75, 0.05, 16, 72]} />
        <meshStandardMaterial color="#efefef" roughness={0.3} metalness={0.05} />
      </mesh>
      {/* Fill overlay */}
      <mesh position={[0, 0.071, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.55, 64]} />
        <meshStandardMaterial
          color={fillColor}
          roughness={0.6}
          transparent
          opacity={fillOpacity}
        />
      </mesh>
    </group>
  );
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
  dayKey,
  remainingKcal,
  goalKcal,
  consumedKcal,
}: Props) {
  const [items, setItems] = useState<FoodItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const isFirstRef = useRef(true);
  const dayRef = useRef(dayKey);

  // reset on day change
  useEffect(() => {
    if (dayRef.current !== dayKey) {
      dayRef.current = dayKey;
      seenRef.current = new Set();
      isFirstRef.current = true;
      setItems([]);
    }
  }, [dayKey]);

  useEffect(() => {
    const currentIds = new Set(entries.map((e) => e.id));
    const newOnes: FoodItem[] = [];
    for (const e of entries) {
      if (!seenRef.current.has(e.id)) {
        const shape = dominant(e);
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.35;
        newOnes.push({
          id: e.id,
          shape,
          color: COLORS[shape],
          x: Math.cos(angle) * r,
          z: Math.sin(angle) * r,
          y: isFirstRef.current ? 0.22 : 3.5 + Math.random() * 0.5,
          vy: 0,
          rest: isFirstRef.current,
          bornAt: Date.now(),
          rot: [
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          ],
        });
        seenRef.current.add(e.id);
      }
    }
    setItems((prev) => {
      const filtered = prev.filter((it) => currentIds.has(it.id));
      const merged = [...filtered, ...newOnes];
      return merged.slice(-15);
    });
    isFirstRef.current = false;
  }, [entries]);

  const fillPct = goalKcal > 0 ? consumedKcal / goalKcal : 0;
  const over = remainingKcal < 0;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative mx-auto w-full">
      <div className="h-[300px] w-full">
        {mounted && (
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 2.6, 3.4], fov: 38 }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[2.5, 5, 3]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <Plate fillPct={fillPct} />
          {items.map((it, i) => {
            const fadeIdx = items.length - 1 - i; // 0 = newest
            const opacity =
              items.length <= 12 ? 1 : Math.max(0.3, 1 - (i < items.length - 12 ? (items.length - 12 - i) * 0.25 : 0));
            void fadeIdx;
            return <FoodMesh key={it.id} item={it} opacity={opacity} />;
          })}
        </Canvas>
        )}
      </div>
      <div className="-mt-6 flex flex-col items-center pointer-events-none">
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
