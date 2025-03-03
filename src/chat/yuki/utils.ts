import { info } from "../../utils/logging/logger"

export interface Invocation {
  directive: string
  parameters: string[]
  parsedParameters?: string[]
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
  expectedLength: number,
  options: Partial<TakeAndVerifyParametersOptions> = {}
): string[] {
  const { fillInTemplate = true } = options
  const parameters = fillInTemplate
    ? invocation.parsedParameters
    : invocation.parameters
  if (!parameters) {
    info("[yuki] No parameters found in event")
    return []
  }
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

export interface TakeAndVerifyParametersOptions {
  fillInTemplate: boolean
}
