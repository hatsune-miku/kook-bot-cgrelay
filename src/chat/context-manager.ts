import { ContextUnit } from "./types"

export class ContextManager {
    private userIdToContext = new Map<string, ContextUnit[]>()

    getContext(userId: string): ContextUnit[] {
        if (!this.userIdToContext.has(userId)) {
            this.userIdToContext.set(userId, [])
        }
        return this.userIdToContext.get(userId)!
    }

    getMixedContext(): ContextUnit[] {
        const units = Object.keys(this.userIdToContext)
            .map(userId => this.userIdToContext.get(userId)!)
            .flat()
        units.sort((a, b) => a.timestamp - b.timestamp)
        console.log(units.slice(0, 12))
        return units.slice(0, 12)
    }

    appendToContext(
        userId: string,
        displayName: string,
        role: ContextUnit['role'],
        content: ContextUnit['content']
    ) {
        const context = this.getContext(userId)
        context.push({
            role: role,
            name: displayName,
            content: content,
            timestamp: Date.now(),
        })

        if (context.length > 12) {
            context.splice(context.length - 12)
        }
    }
}
