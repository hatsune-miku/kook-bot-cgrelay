export interface ContextUnit {
  role: "assistant" | "user";
  name: string;
  content: string;
  timestamp: number;
}
