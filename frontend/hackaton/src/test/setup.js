import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  })
}

// jsdom does not implement scrolling; Layout scrolls to top on every route change.
window.scrollTo = () => {}

// jsdom has no ResizeObserver; the immersive hero measures its page with one.
window.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
}
