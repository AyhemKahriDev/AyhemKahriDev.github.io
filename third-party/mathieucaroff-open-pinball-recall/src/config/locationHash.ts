import { PinballConfig } from './config'

export type ConfigUpdate = Partial<
  Pick<
    PinballConfig,
    | 'size'
    | 'bumperCount'
    | 'baseBumperViewTimeMs'
    | 'perBumperViewTimeMs'
    | 'ballSpeed'
    | 'roundCount'
    | 'practiceMode'
    | 'seed'
    | 'pauseAfterSuccess'
    | 'pauseAfterFailure'
    | 'remaining'
    | 'score'
    | 'successCount'
    | 'failureCount'
  >
>

export function updateConfigHash(location: Location, update: ConfigUpdate) {
  let params = new Map<string, string>()
  for (let entry of location.hash.slice(1).split('#')) {
    if (!entry) {
      continue
    }
    let [key, ...value] = entry.split('=')
    params.set(key, value.join('='))
  }

  let size = update.size ?? Number(params.get('difficulty')?.split(':')[0] ?? 4)
  let bumperCount = update.bumperCount ?? Number(params.get('difficulty')?.split(':')[1] ?? 5)
  params.set('difficulty', `${size}:${bumperCount}`)
  params.delete('size')
  params.delete('bumperCount')

  for (let [key, value] of Object.entries(update)) {
    if (key === 'size' || key === 'bumperCount' || value === undefined) {
      continue
    }
    if (typeof value === 'boolean') {
      if (value) {
        params.set(key, '')
      } else {
        params.delete(key)
      }
    } else {
      params.set(key, String(value))
    }
  }

  location.hash = [...params].map(([key, value]) => (value ? `${key}=${value}` : key)).join('#')
}

export function startNewSession(location: Location, update: ConfigUpdate) {
  updateConfigHash(location, update)
  let keys = ['remaining', 'score', 'successCount', 'failureCount']
  let params = location.hash
    .slice(1)
    .split('#')
    .filter((entry) => entry && !keys.some((key) => entry === key || entry.startsWith(`${key}=`)))
  location.hash = params.join('#')
}
