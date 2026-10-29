export let create = <K extends keyof HTMLElementTagNameMap>(
  name: K,
  attribute: Partial<Omit<HTMLElementTagNameMap[K], 'style'>> & {
    style?: Partial<CSSStyleDeclaration>
  } = {},
  children: Element[] = [],
) => {
  // Create element
  let elem = document.createElement<K>(name)

  // Copy each attribute
  Object.entries(attribute as Record<string, unknown>).forEach(([name, value]) => {
    if (name === 'style') {
      Object.assign(elem.style, value)
      return
    }

    if (name in elem) {
      ;(elem as unknown as Record<string, unknown>)[name] = value
    } else {
      elem.setAttribute(name, String(value))
    }
  })

  // Insert each child
  children.forEach((child) => {
    elem.appendChild(child)
  })

  return elem
}
