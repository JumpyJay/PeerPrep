// /src/app/collaboration/sessions/[id]/useChat.ts

"use client";
import { useEffect, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  session_id: number;
  sender_email: string;
  content: string;
  created_at: string;
};

export function useChat(sessionId: number, me: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const sinceRef = useRef<string | null>(null);
  const lastModifiedRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<number | null>(null);
  const idleCountRef = useRef(0);

  const pollIntervalMs = () => (idleCountRef.current >= 3 ? 6000 : 2000); // 2s active, backoff to 6s

  // initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/v1/collaboration/sessions/${sessionId}/chat`);
      if (res.status !== 304) {
        const data: ChatMessage[] = await res.json();
        if (!cancelled) {
            // send state + de-dupe
          setMessages(data);
          seenIdsRef.current = new Set(data.map(m => m.id));
          sinceRef.current = data.at(-1)?.created_at ?? null;
        }
      }
      lastModifiedRef.current = res.headers.get("Last-Modified");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // polling with visibility pause and 304 handling
  useEffect(() => {
    let stopped = false;

    function schedule() {
        if (stopped) return;
        timerRef.current = window.setTimeout(tick, pollIntervalMs());
    }

    async function tick() {
        if (stopped) return;
        if (document.hidden) return schedule(); // pause in background tabs

      const q = sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : "";
      const headers: Record<string, string> = {};
      if (lastModifiedRef.current) headers["If-Modified-Since"] = lastModifiedRef.current;

      const res = await fetch(`/api/v1/collaboration/sessions/${sessionId}/chat${q}`, { headers });
      if (res.status === 304) {
        idleCountRef.current++;
      } else {
        idleCountRef.current = 0;
        const delta: ChatMessage[] = await res.json();
        if (delta.length) {
            // append only unseen ids
            const fresh = delta.filter(m => !seenIdsRef.current.has(m.id));
            if (fresh.length) {
                fresh.forEach(m => seenIdsRef.current.add(m.id));
                setMessages(prev => [...prev, ...fresh]);
                sinceRef.current = fresh.at(-1)!.created_at;
            }
        }
      }
      lastModifiedRef.current = res.headers.get("Last-Modified");
      schedule();
    }

    schedule();
    const onVis = () => { if (!document.hidden && timerRef.current === null) schedule(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stopped = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sessionId]);

  const send = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    // optimistic UI
    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      sender_email: me,
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimistic]);

    const res = await fetch(`/api/v1/collaboration/sessions/${sessionId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed }),
    });

    if (res.ok) {
      const saved: ChatMessage = await res.json();
      setMessages(prev => {
        // drop optimistic + any accidental dup of saved.id
        const next = prev.filter(m => m.id !== optimistic.id && m.id !== saved.id);
        seenIdsRef.current.add(saved.id);
        sinceRef.current = saved.created_at;
        return [...next, saved];
      });
    } else {
        // revert optimistic on failure
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    }
  };

  return { messages, loading, send };
}
