import { ContextUnit } from "../chat/types"

const CONTEXT_LENGTH_LIMIT = 12
const globalUserIdToContext = new Map<string, ContextUnit[]>()

function getContext(userId: string): ContextUnit[] {
    if (!globalUserIdToContext.has(userId)) {
        globalUserIdToContext.set(userId, [])
    }
    return globalUserIdToContext.get(userId)!
}

function appendToContext(userId: string, unit: ContextUnit) {
    const context = getContext(userId)
    context.push(unit)
    if (context.length > CONTEXT_LENGTH_LIMIT) {
        context.shift()
    }
}

function promptFromMessage(rawContent: string): string {
    let content = rawContent.replace(/\(rol\)\d+\(rol\)/g, '')
    content = rawContent.replace(/\(met\)\d+\(met\)/g, '')
    return content
}
