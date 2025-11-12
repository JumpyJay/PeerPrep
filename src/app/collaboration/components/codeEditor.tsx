"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { io, Socket } from "socket.io-client";
import * as monaco from "monaco-editor";

// dynamically import Monaco editor
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface CodeEditorProps {
  sessionId: number;
}

type TranslationStyle = "literal" | "idiomatic";

interface TranslationResult {
  translatedCode: string;
  provider: string;
  cached: boolean;
}

interface CodePayload {
  value?: string;
}

const defaultCode = `function twoSum(nums: number[], target: number): number[] {
  // Write your solution here
};`;

const languageOptions = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
];

export function CodeEditor({ sessionId }: CodeEditorProps) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const [language, setLanguage] = useState("typescript");
  const [targetLanguage, setTargetLanguage] = useState(
    languageOptions.find((o) => o.value !== "typescript")?.value ?? languageOptions[0].value
  );
  const [translationStyle, setTranslationStyle] = useState<TranslationStyle>("idiomatic");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translation, setTranslation] = useState<TranslationResult | null>(null);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);

  const languageLabel = useMemo(
    () => languageOptions.find((o) => o.value === language)?.label ?? language,
    [language]
  );

  const targetLanguageLabel = useMemo(
    () => languageOptions.find((o) => o.value === targetLanguage)?.label ?? targetLanguage,
    [targetLanguage]
  );

  useEffect(() => {
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit("join-session", sessionId);
    };

    const onDisconnect = () => setConnected(false);

    const onReceiveCode = (payload: string | CodePayload) => {
      if (!editorRef.current) return;
      try {
        const model = editorRef.current.getModel();
        if (!model) return;

        if (typeof payload === "string") {
          model.setValue(payload);
        } else if (payload.value) {
          model.setValue(payload.value);
        }
      } catch (e) {
        console.warn("Failed to apply remote code", e);
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive-code", onReceiveCode);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive-code", onReceiveCode);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  const handleEditorMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
      editorRef.current = editor;
      monacoRef.current = monacoInstance;

      const model = editor.getModel();
      if (model && !model.getValue()) model.setValue(defaultCode);

      editor.onDidChangeModelContent(() => {
        if (!socketRef.current || !connected) return;
        socketRef.current.emit("send-code", { value: editor.getValue() });
      });
    },
    [connected]
  );

  const getCurrentCode = useCallback(() => {
    return editorRef.current?.getValue() ?? "";
  }, []);

  const handleReset = useCallback(() => {
    if (editorRef.current) editorRef.current.setValue(defaultCode);
    setTranslation(null);
    setTranslationError(null);
  }, []);

  const handleTranslate = async () => {
    const currentCode = getCurrentCode().trim();
    if (!currentCode) {
      setTranslationError("Please provide some code to translate.");
      return;
    }
    if (language === targetLanguage) {
      setTranslationError("Choose a different target language.");
      return;
    }

    setTranslationError(null);
    setIsTranslating(true);

    try {
      const response = await fetch("/api/v1/question/translate/ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCode: currentCode,
          fromLang: languageLabel,
          toLang: targetLanguageLabel,
          style: translationStyle,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload?.error ?? "Translation failed. Please try again.");
      }

      const payload = (await response.json()) as TranslationResult;
      setTranslation(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to translate right now.";
      setTranslationError(message);
      setTranslation(null);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopyTranslation = async () => {
    if (!translation?.translatedCode) return;
    try {
      await navigator.clipboard.writeText(translation.translatedCode);
    } catch {
      setTranslationError("Could not copy to clipboard. Please copy manually.");
    }
  };

  const handleReplaceEditor = () => {
    if (!translation?.translatedCode) return;
    if (editorRef.current) editorRef.current.setValue(translation.translatedCode);
  };

  return (
    <div className="flex w-1/2 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground outline-none hover:bg-secondary/80"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Button variant="ghost" onClick={handleReset}>
            Reset
          </Button>

          <span className={`text-xs ${connected ? "text-green-500" : "text-red-500"}`}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-code-bg">
        <div className="flex h-full font-mono text-sm">
          <div className="flex-1 p-0">
            <MonacoEditor
              height="420px"
              defaultLanguage={language}
              language={language}
              defaultValue={defaultCode}
              theme="vs"
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontFamily: "Fira Code, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                fontSize: 13,
                tabSize: 2,
                smoothScrolling: true,
                autoClosingBrackets: "always",
                autoClosingQuotes: "always",
                automaticLayout: true,
                formatOnPaste: true,
                formatOnType: true,
                quickSuggestions: true,
              }}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Translate to</span>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground outline-none hover:bg-secondary/80"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.value === language}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Style</span>
              <select
                value={translationStyle}
                onChange={(e) => setTranslationStyle(e.target.value as TranslationStyle)}
                className="rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground outline-none hover:bg-secondary/80"
              >
                <option value="idiomatic">Idiomatic</option>
                <option value="literal">Literal</option>
              </select>
            </div>
          </div>

          <Button onClick={handleTranslate} disabled={isTranslating} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {isTranslating ? "Translating..." : "Translate Code"}
          </Button>
        </div>
        {translationError && <p className="mt-2 text-sm text-destructive">{translationError}</p>}
      </div>

      {translation && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Translation to {targetLanguageLabel} ({translation.provider}
                {translation.cached ? ", cached" : ""})
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleCopyTranslation}>
                  Copy
                </Button>
                <Button variant="secondary" size="sm" onClick={handleReplaceEditor}>
                  Replace Editor
                </Button>
              </div>
            </div>
            <textarea
              value={translation.translatedCode}
              readOnly
              className="h-32 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
            />
          </div>
        </div>
      )}

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
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">nums =</label>
                <input
                  type="text"
                  defaultValue="[2,7,11,15]"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">target =</label>
                <input
                  type="text"
                  defaultValue="9"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="result" className="h-40 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground">Run your code to see results...</p>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Submit</Button>
      </div>
    </div>
  );
}
