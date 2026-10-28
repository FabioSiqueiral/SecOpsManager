"use client";
import dynamic from "next/dynamic";
const Workspace = dynamic(() => import("@/components/Workspace"), {
  ssr: false,
  loading: () => (
    <main style={{ padding: 48, fontFamily: "Arial" }}>
      Carregando SecOps Manager…
    </main>
  ),
});
export default function Page() {
  return <Workspace />;
}
