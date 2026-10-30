import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { demo } from "../demo";

// 체험 모드에서 어느 화면에서나 위에 보이는 안내. 가상 데이터이고 실제 일정은 만들어지지 않는다는 것을 알려요.
export function DemoRibbon() {
  const [on, setOn] = useState(demo.on);
  useEffect(() => {
    const sync = () => setOn(demo.on);
    window.addEventListener("nodi:demo", sync);
    return () => window.removeEventListener("nodi:demo", sync);
  }, []);
  useEffect(() => {
    document.body.classList.toggle("demo-on", on);
    return () => document.body.classList.remove("demo-on");
  }, [on]);
  if (!on) return null;
  return (
    <div className="demo-ribbon" role="note">
      <Info aria-hidden="true" size={14} />
      <span>체험용 데모 · 가상 데이터예요. 실제 일정은 등록되지 않아요.</span>
    </div>
  );
}
