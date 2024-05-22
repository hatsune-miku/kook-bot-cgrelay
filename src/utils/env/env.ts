import 'dotenv/config'

export const Env = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    OPENAI_API_KEYS: process.env.OPENAI_API_KEYS?.split(',') || []
}

export interface EnvType {
    BotToken: string
    OpenAIKeys: string[]
}
