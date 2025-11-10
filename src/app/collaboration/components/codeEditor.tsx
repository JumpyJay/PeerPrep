"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { io } from "socket.io-client";
import "quill/dist/quill.snow.css";
import type QuillType from "quill";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CodeEditorProps {
  sessionId: number;
}

interface TranslationResult {
  translatedCode: string;
  provider: string;
  cached: boolean;
}

const defaultCode = ``;

type TranslationStyle = "literal" | "idiomatic";

interface TranslationResult {
  translatedCode: string;
  provider: string;
  cached: boolean;
}

const languageOptions = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
];

export function CodeEditor({ sessionId }: CodeEditorProps) {
  const router = useRouter();
  const quillRef = useRef<QuillType | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [connected, setConnected] = useState(false);

  const [language, setLanguage] = useState("typescript");
  const [targetLanguage, setTargetLanguage] = useState(
    languageOptions.find((option) => option.value !== "typescript")?.value ??
      languageOptions[0].value
  );
  const [translationStyle, setTranslationStyle] =
    useState<TranslationStyle>("idiomatic");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translation, setTranslation] = useState<TranslationResult | null>(
    null
  );

  const languageLabel = useMemo(() => {
    return (
      languageOptions.find((option) => option.value === language)?.label ??
      language
    );
  }, [language]);

  const targetLanguageLabel = useMemo(() => {
    return (
      languageOptions.find((option) => option.value === targetLanguage)
        ?.label ?? targetLanguage
    );
  }, [targetLanguage]);

  useEffect(() => {
    const s = io("http://localhost:3001");
    socketRef.current = s;

    const onConnect = () => {
      setConnected(true);
      s.emit("join-session", sessionId);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onReceiveCode = (payload: any) => {
      const q = quillRef.current;
      if (!q) return;
      q.updateContents(payload, "api");
    };

    const onPartnerDisconnect = () => {
      // Show the toast
      toast.warning(
        "Partner disconnected, session will be terminated in 10 seconds."
      );
    };

    const onTerminateSession = () => {
      console.log("[socket] Session terminated by server.");

      // Show the toast
      toast.error(
        "Session Terminated, You were the only one in the room for 10 seconds."
      );

      // Navigate to homepage
      router.push("/");
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("receive-code", onReceiveCode);
    s.on("terminate-session", onTerminateSession);
    s.on("partner-disconnect", onPartnerDisconnect);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("receive-code", onReceiveCode);
      s.off("terminate-session", onTerminateSession);
      s.off("partner-disconnect", onPartnerDisconnect);
      s.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  const wrapperRef = useCallback(
    (wrapper: HTMLDivElement | null) => {
      if (!wrapper) return;
      if (typeof window === "undefined") return;
      if (quillRef.current) return;

      (async () => {
        const Quill = (await import("quill")).default;
        const host = document.createElement("div");
        wrapper.innerHTML = "";
        wrapper.append(host);

        const quill = new Quill(host, {
          theme: "snow",
          modules: { toolbar: false, history: { userOnly: true } },
          placeholder: "Start solving…",
        });
        quill.root.setAttribute("spellcheck", "false");
        quill.root.classList.add("font-mono");
        quill.setText(defaultCode);

        const onTextChange = (delta: any, _old: any, source: string) => {
          if (source !== "user") return;
          if (!socketRef.current || !connected) return;
          const payload = { ops: delta.ops };
          socketRef.current.emit("send-code", payload);
        };

        quill.on("text-change", onTextChange);
        quillRef.current = quill;
      })();
    },
    [connected]
  );

  const getCurrentCode = useCallback((): string => {
    const quill = quillRef.current;
    if (!quill) return "";
    return quill.getText();
  }, []);

  const handleReset = useCallback(() => {
    quillRef.current?.setText(defaultCode);
    setTranslation(null);
    setTranslationError(null);
  }, []);

  async function handleTranslate() {
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
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          payload?.error ?? "Translation failed. Please try again."
        );
      }

      const payload = (await response.json()) as TranslationResult;
      setTranslation(payload);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to translate right now.";
      setTranslationError(message);
      setTranslation(null);
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleCopyTranslation() {
    if (!translation?.translatedCode) return;
    try {
      await navigator.clipboard.writeText(translation.translatedCode);
    } catch {
      setTranslationError("Could not copy to clipboard. Please copy manually.");
    }
  }

  function handleReplaceEditor() {
    if (!translation?.translatedCode) return;
    quillRef.current?.setText(translation.translatedCode);
  }

  return (
    <div className="flex w-1/2 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
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
          <span
            className={`text-xs ${
              connected ? "text-green-500" : "text-red-500"
            }`}
          >
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-code-bg">
        <div className="flex h-full font-mono text-sm">
          <div className="flex-1 p-0">
            <div ref={wrapperRef} className="quill-textarea h-full w-full" />
          </div>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">
                Translate to
              </span>
              <select
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                className="rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground outline-none hover:bg-secondary/80"
              >
                {languageOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.value === language}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Style</span>
              <select
                value={translationStyle}
                onChange={(event) =>
                  setTranslationStyle(event.target.value as TranslationStyle)
                }
                className="rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground outline-none hover:bg-secondary/80"
              >
                <option value="idiomatic">Idiomatic</option>
                <option value="literal">Literal</option>
              </select>
            </div>
          </div>
          <Button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isTranslating ? "Translating..." : "Translate Code"}
          </Button>
        </div>
        {translationError && (
          <p className="mt-2 text-sm text-destructive">{translationError}</p>
        )}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyTranslation}
                >
                  Copy
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReplaceEditor}
                >
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
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  nums =
                </label>
                <input
                  type="text"
                  defaultValue="[2,7,11,15]"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  target =
                </label>
                <input
                  type="text"
                  defaultValue="9"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="result" className="h-40 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground">
              Run your code to see results...
            </p>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          Submit
        </Button>
      </div>
    </div>
  );
}
