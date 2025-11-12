// /src/app/collaboration/sessions/[id]/ChatPanel.tsx

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChat } from "./useChat";

export function ChatPanel({ sessionId, me }: { sessionId: number, me: string}) {
    const meLc = useMemo(() => (me ?? "").toLowerCase(), [me])
    const { messages, loading, send } = useChat(sessionId, me);
    const [text, setText] = useState("");
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

    const canSend = text.trim().length > 0;

    return (
        <div className="flex h-full flex-col border-l border-border">
            <div className="h-14 flex items-center px-4 font-medium">Chat</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
                {messages.map((m) => {
                    const mine = m.sender_email.toLowerCase() === meLc;
                    return (
                    <div
                        key={m.id}
                        className={`max-w-[75%] rounded-lg p-2 text-sm ${
                            mine ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                        }`}
                        title={m.sender_email}
                    >
                        <div className="opacity-70 text-[11px] mb-0.5">{mine ? "You" : m.sender_email}</div>
                        <div>{m.content}</div>
                    </div>
                    );
                })}
                <div ref={endRef} />
            </div>
            <form
                className="flex gap-2 p-2 border-t border-border"
                onSubmit={async (e) => {
                    e.preventDefault();
                    if (!canSend) return;
                    await send(text);
                    setText("");
                }}
            >
                <Input 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Message your partner..."
                    aria-label="Type a messaeg"
                />
                <Button type="submit" disabled={!canSend} aria-disabled={!canSend}>
                    Send
                </Button>
            </form>
        </div>
    );
}