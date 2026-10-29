export type DefaultConfigObject<T> = {
  [K in keyof T]: (param: Indirect<T>) => T[K]
}

export type Indirect<T> = {
  [K in keyof T]: () => T[K]
}

type ConfigValue = string | number | boolean
type RawConfig<T> = Partial<Record<keyof T, string | true>>

export let resolveConfig = <T extends object>(
  location: Location,
  defaultConfig: DefaultConfigObject<T>,
) => {
  let rawConfig: RawConfig<T> = {}

  location.hash
    .split('#')
    .slice(1)
    .forEach((piece) => {
      let [key, ...valueList] = piece.split('=')
      if (!(key in defaultConfig)) {
        return
      }

      if (piece.includes('=')) {
        rawConfig[key as keyof T] = valueList.join('=')
      } else {
        rawConfig[key as keyof T] = true
      }
    })

  let resolveDefaults = (providedConfig: Partial<T>) => {
    let config = {} as T
    let stackedConfig = {} as Indirect<T>

    for (let key of Object.keys(defaultConfig) as (keyof T)[]) {
      if (key in providedConfig) {
        stackedConfig[key] = () => providedConfig[key] as T[typeof key]
      } else {
        stackedConfig[key] = () => defaultConfig[key](stackedConfig)
      }
    }

    for (let key of Object.keys(defaultConfig) as (keyof T)[]) {
      config[key] = stackedConfig[key]()
    }

    return config
  }

  let defaultValues = resolveDefaults({})
  let parsedConfig = {} as Partial<T>

  for (let key of Object.keys(rawConfig) as (keyof T)[]) {
    let value = rawConfig[key]
    let defaultValue = defaultValues[key] as ConfigValue
    if (typeof defaultValue === 'boolean') {
      if (value === true || value === 'true') {
        parsedConfig[key] = true as T[typeof key]
      } else if (value === 'false') {
        parsedConfig[key] = false as T[typeof key]
      }
    } else if (
      typeof defaultValue === 'number' &&
      typeof value === 'string' &&
      value.trim() !== ''
    ) {
      let numberValue = Number(value)
      if (Number.isFinite(numberValue)) {
        parsedConfig[key] = numberValue as T[typeof key]
      }
    } else if (typeof defaultValue === 'string' && value !== true) {
      parsedConfig[key] = value as T[typeof key]
    }
  }

  return resolveDefaults(parsedConfig)
}
