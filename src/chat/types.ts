export interface ContextUnit {
    role: 'assistant' | 'user'
    content: string
    name: string
    timestamp: number
}
