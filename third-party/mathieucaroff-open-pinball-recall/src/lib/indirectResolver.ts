export type InfoObject<T> = {
  [K in keyof T]: (param: Indirect<T>) => T[K]
}

export type Indirect<T> = {
  [K in keyof T]: () => T[K]
}

export function indirectResolve<T extends object>(info: InfoObject<T>): T {
  let result = {} as T

  let resolver = {} as Indirect<T>
  let keys = Object.keys(info) as (keyof T)[]

  keys.forEach((key) => {
    resolver[key] = () => {
      let value = info[key](resolver)
      resolver[key] = () => value
      return value
    }
  })

  keys.forEach((key) => {
    result[key] = resolver[key]()
  })

  return result
}
