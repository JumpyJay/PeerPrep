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

    const onPartnerConnect = () => {
      toast.success("Partner connected!");
    };

    const onTerminateSession = async () => {
      console.log("[socket] Session terminated by server.");
      // call collaboration service to delete the session
      try {
        const response = await fetch(
          "/api/v1/collaboration?type=deletesession",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          }
        );

        if (response.ok) {
          console.log("session deleted!");
        } else {
          console.error("Failed to delete session");
        }
      } catch (error) {
        console.error("Error deleting session:", error);
      }

      // Show the toast
      toast.error(
        "Session Terminated, You were the only one in the room for 10 seconds."
      );

      // Navigate to homepage
      router.push("/");
    };

    const onCompleteSession = () => {
      console.log("[socket] Session completed by server.");

      // Show the toast
      toast.success("Session Completed!!");

      // Navigate to homepage
      router.push("/");
    };

    const getFullCode = (requesterSocketId: string) => {
      console.log("Client: Received request for full code.");
      const quill = quillRef.current;
      if (!quill) return;
      // get the full text contents of the editor
      const fullCode = quill.getText();
      // send back to server
      s.emit("send-full-code", {
        code: fullCode,
        targetSocketId: requesterSocketId,
      });
    };

    const receiveFullCode = (fullCode: any) => {
      console.log("Client: Received full code, setting editor content.");
      console.log("full code: ", fullCode);
      // sync editor content
      const quill = quillRef.current;
      if (!quill) return;
      quill.setText(String(fullCode));
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("receive-code", onReceiveCode);
    s.on("terminate-session", onTerminateSession);
    s.on("partner-disconnect", onPartnerDisconnect);
    s.on("complete-session", onCompleteSession);
    s.on("partner-connect", onPartnerConnect);
    s.on("get-full-code", getFullCode);
    s.on("receive-full-code", receiveFullCode);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("receive-code", onReceiveCode);
      s.off("terminate-session", onTerminateSession);
      s.off("partner-disconnect", onPartnerDisconnect);
      s.off("complete-session", onCompleteSession);
      s.off("partner-connect", onPartnerConnect);
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

  // define function for submit code
  const handleSubmitCode = () => {
    console.log("[socket] Submitting code.");
    if (!socketRef.current || !connected) return;
    const code = quillRef.current?.getText() ?? "";
    socketRef.current.emit("submit-code", String(sessionId), code);
  };

  // define function for handle end session
  const handleEndSession = () => {
    console.log("[socket] End session.");

    // navigate to homepage
    router.push("/");
  };

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
        <Button onClick={() => handleEndSession()}>End Session</Button>
      </div>

      <div className="flex-1 overflow-y-auto bg-code-bg">
        <div className="flex h-full font-mono text-sm">
          <div className="flex-1 p-0">
            <div ref={wrapperRef} className="quill-textarea h-full w-full" />
          </div>
        </div>
      </div>

      <div className="border-t border-border px-4 pt-3 pb-5">
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
          <div className="space-x-1">
            <Button
              onClick={handleTranslate}
              disabled={isTranslating}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isTranslating ? "Translating..." : "Translate Code"}
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleSubmitCode()}
            >
              Submit
            </Button>
          </div>
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
    </div>
  );
}
