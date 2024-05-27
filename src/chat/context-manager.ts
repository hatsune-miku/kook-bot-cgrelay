import { ContextUnit } from "./types"

export class ContextManager {
    private userIdToContext = new Map<string, ContextUnit[]>()

    getContext(userId: string) {
        if (!this.userIdToContext.has(userId)) {
            this.userIdToContext.set(userId, [])
        }
        return this.userIdToContext.get(userId)!
    }

    appendToContext(
        userId: string,
        role: ContextUnit['role'],
        content: ContextUnit['content']
    ) {
        const context = this.getContext(userId)
        context.push({ role, content })
    }
}
