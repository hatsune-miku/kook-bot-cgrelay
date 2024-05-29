export interface ContextUnit {
    role: 'assistant' | 'user'
    content: string
    timestamp: number
}
