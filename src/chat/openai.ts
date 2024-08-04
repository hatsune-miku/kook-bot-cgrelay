/*
 * @Path          : \kook-bot-cgrelay\src\chat\openai.ts
 * @Created At    : 2024-05-22 17:45:24
 * @Last Modified : 2024-05-29 23:00:54
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import OpenAI from "openai";
import { Env } from "../utils/env/env";
import { draw } from "radash";
import { ChatCompletionMessageParam } from "openai/resources";
import { ContextUnit } from "./types";

function makeContext(
  groupChat: boolean,
  context: ContextUnit[]
): ChatCompletionMessageParam[] {
  if (groupChat) {
    const units = context.map((unit) => ({
      role: unit.role === "user" ? "system" : "assistant",
      content:
        unit.role === "user" ? `${unit.name}说: ${unit.content}` : unit.content
    }));
    return [
      {
        role: "system",
        content:
          "你是ChatGPT，作为某即时通讯平台的Bot，为每个用户提供简短的解答。"
      },
      ...(units as ChatCompletionMessageParam[])
    ];
  }
  return [
    {
      role: "system",
      content: "你是ChatGPT，作为某即时通讯平台的Bot，为用户提供简短的解答。"
    },
    ...context
  ];
}

export async function chatCompletionWithoutStream(
  groupChat: boolean,
  context: ContextUnit[]
): Promise<string> {
  const openai = new OpenAI({
    apiKey: draw(Env.OpenAIKeys)!
  });

  let messages = makeContext(groupChat, context);
  if (messages.length > 12) {
    messages = messages.slice(messages.length - 10);
  }

  const completion = await openai.chat.completions.create({
    messages: messages,
    model: "gpt-4o"
  });

  return completion.choices[0].message.content ?? "<no content>";
}
