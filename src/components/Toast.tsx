import { Check } from "lucide-react";
import { useEffect } from "react";

// Toss toast: grey-900 표면 + 흰 라벨, 성공 아이콘은 20px 초록 원 + 흰 체크
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2000);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);
  return <div className="toast" role="status"><span className="toast-icon"><Check /></span>{message}</div>;
}
