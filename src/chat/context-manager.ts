import { ContextUnit } from "./types";

export class ContextManager {
  private userIdToContext = new Map<string, ContextUnit[]>();

  getContext(userId: string): ContextUnit[] {
    if (!this.userIdToContext.has(userId)) {
      this.userIdToContext.set(userId, []);
    }
    return this.userIdToContext.get(userId)!;
  }

  getMixedContext(): ContextUnit[] {
    const units = [];
    for (const context of this.userIdToContext.values()) {
      units.push(...context);
    }
    units.sort((a, b) => a.timestamp - b.timestamp);
    return units.slice(units.length - 12);
  }

  appendToContext(
    userId: string,
    displayName: string,
    role: ContextUnit["role"],
    content: ContextUnit["content"]
  ) {
    const context = this.getContext(userId);
    context.push({
      role: role,
      name: displayName,
      content: content,
      timestamp: Date.now()
    });

    console.log("Pushed", displayName, content);
    if (context.length > 12) {
      context.splice(context.length - 12);
    }
  }
}
