import { SignJWT, importPKCS8 } from "jose"
import { Env } from "../../../../utils/env/env"
import { info } from "../../../../utils/logging/logger"

const keywordToLocationCache: Record<string, LocationResponse> = {}

export async function createQWeatherJWT(): Promise<string> {
  return new Promise((resolve, reject) => {
    importPKCS8(Env.QWeatherPrivateKey, "EdDSA")
      .then((privateKey) => {
        const customHeader = {
          alg: "EdDSA",
          kid: Env.QWeatherKeyId
        }
        const iat = Math.floor(Date.now() / 1000) - 30
        const exp = iat + 900
        const customPayload = {
          sub: Env.QWeatherProjectId,
          iat: iat,
          exp: exp
        }
        new SignJWT(customPayload)
          .setProtectedHeader(customHeader)
          .sign(privateKey)
          .then((token) => {
            info(`[Chat] Create QWeather JWT`, token)
            resolve(token)
          })
      })
      .catch((error) => {
        info(`[Chat] Create QWeather JWT failed`, error)
        reject(error)
      })
  })
}

export async function searchForLocationId(
  keyword: string
): Promise<LocationResponse> {
  if (keywordToLocationCache[keyword]) {
    info(`[Chat] Search for location id from cache`, keyword)
    return keywordToLocationCache[keyword]
  }

  const url = `https://geoapi.qweather.com/v2/city/lookup?location=${keyword}`
  const result = await requestQWeatherApi<LocationResponseData>(url, "GET")
  info(`[Chat] Search for location id`, result)

  if (result?.code !== "200") {
    info(`[Chat] Search for location id failed`, result)
    throw new Error(`请求失败，状态码：${result.code}`)
  }
  if (!result?.location?.[0]) {
    info(`[Chat] Search for location id failed`, result)
    throw new Error("未找到该地区/城市")
  }

  keywordToLocationCache[keyword] = result.location[0]
  return result.location[0]
}

export async function queryRealtimeWeather(
  locationId: string
): Promise<FriendlyWeatherResponse> {
  const url = `https://api.qweather.com/v7/weather/now?lang=zh&unit=m&location=${locationId}`
  const result = await requestQWeatherApi<WeatherResponse>(url, "GET")
  if (result?.code !== "200") {
    info(`[Chat] Query realtime weather failed`, result)
    throw new Error(`请求失败，状态码：${result.code}`)
  }
  return createFriendlyWeatherResult(result)
}

export async function queryRealtimeWeatherByKeyword(
  keyword: string
): Promise<QueryWeatherResult> {
  info(`[Chat] Query realtime weather by keyword`, keyword)
  const location = await searchForLocationId(keyword)

  info(`[Chat] Query realtime weather by location`, location)
  return {
    location: location,
    weather: await queryRealtimeWeather(location.id)
  }
}

export async function requestQWeatherApi<T>(
  url: string,
  method: string
): Promise<T> {
  info(`[Chat] Request QWeather API`, url)
  const token = await createQWeatherJWT()

  info(`[Chat] Request QWeather API token`, token)

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    info(`[Chat] Request QWeather API response`, response)
    if (response.status !== 200) {
      throw new Error(`请求失败，状态码：${response.status}`)
    }

    const responseBody = await response.json()
    return responseBody as T
  } catch (e) {
    info(`[Chat] Request QWeather API failed`, e)
    throw e
  }
}

export interface QueryWeatherResult {
  location: LocationResponse
  weather: FriendlyWeatherResponse
}

export interface WeatherResponse {
  /** 响应码 */
  code: string
  /** 数据更新时间 */
  updateTime: string
  /** 当前数据的响应式页面链接 */
  fxLink: string
  now: {
    /** 数据观测时间 */
    obsTime: string
    /** 温度（摄氏度） */
    temp: string
    /** 体感温度（摄氏度） */
    feelsLike: string
    /** 天气图标代码 */
    icon: string
    /** 天气状况的文字描述 */
    text: string
    /** 风向360角度 */
    wind360: string
    /** 风向 */
    windDir: string
    /** 风力等级 */
    windScale: string
    /** 风速（公里/小时） */
    windSpeed: string
    /** 相对湿度（百分比） */
    humidity: string
    /** 过去1小时降水量（毫米） */
    precip: string
    /** 大气压强（百帕） */
    pressure: string
    /** 能见度（公里） */
    vis: string
    /** 云量（百分比） */
    cloud: string
    /** 露点温度（可能为空） */
    dew: string | null
  }
  refer: {
    /** 原始数据来源 */
    sources: string[]
    /** 数据许可或版权声明 */
    license: string[]
  }
}

export type FriendlyWeatherResponse = {
  description: string
  value: string
}[]

export function createFriendlyWeatherResult(
  result: WeatherResponse
): FriendlyWeatherResponse {
  return [
    { description: "数据观测时间", value: result?.now?.obsTime },
    { description: "温度（摄氏度）", value: `${result?.now?.temp}` },
    { description: "体感温度（摄氏度）", value: `${result?.now?.feelsLike}` },
    { description: "天气状况", value: result?.now?.text },
    { description: "风向", value: result?.now?.windDir },
    { description: "风力等级", value: result?.now?.windScale },
    { description: "风速（公里/小时）", value: `${result?.now?.windSpeed}` },
    { description: "相对湿度（百分比）", value: `${result?.now?.humidity}` },
    {
      description: "过去1小时降水量（毫米）",
      value: `${result?.now?.precip}`
    },
    { description: "大气压强（百帕）", value: `${result?.now?.pressure}` },
    { description: "能见度（公里）", value: `${result?.now?.vis}` },
    { description: "云量（百分比）", value: `${result?.now?.cloud}` },
    {
      description: "露点温度（摄氏度）",
      value: result?.now?.dew !== null ? `${result?.now?.dew}` : "暂无数据"
    }
  ]
}

export interface LocationResponse {
  /** 地区/城市名称 */
  name: string
  /** 地区/城市ID */
  id: string
  /** 地区/城市纬度 */
  lat: string
  /** 地区/城市经度 */
  lon: string
  /** 地区/城市的上级行政区划名称 */
  adm2: string
  /** 地区/城市所属一级行政区域 */
  adm1: string
  /** 地区/城市所属国家名称 */
  country: string
  /** 地区/城市所在时区 */
  tz: string
  /** 地区/城市目前与UTC时间偏移的小时数 */
  utcOffset: string
  /** 地区/城市是否当前处于夏令时 */
  isDst: string
  /** 地区/城市的属性 */
  type: string
  /** 地区评分 */
  rank: string
  /** 该地区的天气预报网页链接 */
  fxLink: string
}

export interface LocationResponseData {
  code: string
  location: LocationResponse[]
  refer: {
    sources: string[]
    license: string[]
  }
}
