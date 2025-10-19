"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { io } from "socket.io-client";
import "quill/dist/quill.snow.css";

const defaultCode = `function twoSum(nums: number[], target: number): number[] {
  // Write your solution here
};`;

export function CodeEditor() {
  // store quill and socket instance that persists between re-render
  const quillRef = useRef<any>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [connected, setConnected] = useState(false);

  // initialise web socket
  useEffect(() => {
    const s = io("http://localhost:3001");
    socketRef.current = s;

    const onConnect = () => {
      setConnected(true);
      console.log("[socket] connected", s.id);
    };
    const onDisconnect = () => {
      setConnected(false);
      console.log("[socket] disconnected");
    };
    const onReceiveCode = (payload: any) => {
      const q = quillRef.current; // safe to read a ref even if it's still null
      if (!q) return; // editor not ready yet; ignore early messages
      q.updateContents(payload, "api"); // apply remote ops when editor exists
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("receive-code", onReceiveCode);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("receive-code", onReceiveCode);
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Callback ref: mount quill and bind handler immediately
  const wrapperRef = useCallback(
    (wrapper: HTMLDivElement | null) => {
      if (!wrapper) return;
      // SSR guard
      if (typeof window === "undefined") return;
      // return if already initialised
      if (quillRef.current) return;

      (async () => {
        const Quill = (await import("quill")).default;

        // fresh host for Quill to own
        const host = document.createElement("div");
        wrapper.innerHTML = "";
        wrapper.append(host);

        const q = new Quill(host, {
          theme: "snow",
          modules: { toolbar: false, history: { userOnly: true } },
          placeholder: "Start solving…",
        });
        q.root.setAttribute("spellcheck", "false");
        q.root.classList.add("font-mono");

        // Seed content
        q.setText(defaultCode);

        // attach handler
        const onTextChange = (delta: any, _old: any, source: string) => {
          if (source !== "user") return;
          if (!socketRef.current || !connected) return;

          // send plain JSON
          const payload = { ops: delta.ops };
          socketRef.current.emit("send-code", payload);
        };

        q.on("text-change", onTextChange);

        // save quill instance
        quillRef.current = q;
      })();
    },
    [connected]
  );

  return (
    <div className="flex w-1/2 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => quillRef.current?.setText(defaultCode)}
          >
            Reset
          </Button>
          <span
            className={`text-xs ${
              connected ? "text-green-500" : "text-red-500"
            }`}
          >
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-y-auto bg-code-bg">
        <div className="flex h-full font-mono text-sm">
          <div className="flex-1 p-0">
            {/* Quill mounts here */}
            <div ref={wrapperRef} className="quill-textarea h-full w-full" />
          </div>
        </div>
      </div>

      {/* Bottom Panel (unchanged) */}
      <div className="border-t border-border">
        <Tabs defaultValue="testcase" className="flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4">
            <TabsTrigger
              value="testcase"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Testcase
            </TabsTrigger>
            <TabsTrigger
              value="result"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Test Result
            </TabsTrigger>
          </TabsList>
          <TabsContent value="testcase" className="h-40 overflow-y-auto p-4">
            {/* ...inputs... */}
          </TabsContent>
          <TabsContent value="result" className="h-40 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground">
              Run your code to see results...
            </p>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button variant="outline">Run</Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          Submit
        </Button>
      </div>
    </div>
  );
}
