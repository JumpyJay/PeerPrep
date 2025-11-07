export interface CodeTranslationRequest {
  sourceCode: string;
  fromLang: string;
  toLang: string;
  style?: "literal" | "idiomatic";
}

export interface CodeTranslationResult {
  translatedCode: string;
  provider: string;
  cached: boolean;
}
