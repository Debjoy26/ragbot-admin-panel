import { expect, it } from 'vitest'
import { groups, screens } from './navigation'

it('gives every client navigation entry a unique relative route', () => {
  const paths = screens.map(({ path }) => path)
  expect(paths).toEqual(groups.flatMap((group) => group.screens.map(({ path }) => path)))
  expect(new Set(paths).size).toBe(paths.length)
  expect(paths.every((path) => /^[a-z-]+(?:\/[a-z-]+)*$/.test(path))).toBe(true)
})
