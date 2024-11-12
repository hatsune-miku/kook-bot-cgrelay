import { info } from "../../utils/logging/logger"

export interface Invocation {
  directive: string
  parameters: string[]
}

export function parseDirectiveInvocation(
  parameter?: string
): Invocation | undefined {
  if (!parameter || !parameter.startsWith("/")) {
    info("[yuki] No parameters found in event")
    return undefined
  }

  parameter = parameter.slice(1)
  const components = parameter.split(" ")
  if (components.length === 0) {
    info("[yuki] No components found in event")
    return undefined
  }

  const directive = components[0]
  const parameters = components.slice(1).filter((x) => x.length > 0)
  return { directive, parameters }
}

export function takeAndVerifyParameters(
  invocation: Invocation,
  expectedLength: number
): string[] {
  const parameters = invocation.parameters
  if (parameters.length < expectedLength) {
    info(
      `[yuki] Expected ${expectedLength} parameters, but got ${parameters.length}`
    )
    return []
  }

  const expected = parameters.slice(0, expectedLength)
  const rest = parameters.slice(expectedLength).join(" ")
  return [...expected, rest]
}
