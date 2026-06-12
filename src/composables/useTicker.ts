import { ref } from 'vue'

export const now = ref(Date.now())

let timer: ReturnType<typeof setInterval> | null = null
let refCount = 0

export function startTicker(): () => void {
  refCount++
  if (!timer) {
    timer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }
  return () => {
    refCount--
    if (refCount <= 0 && timer) {
      clearInterval(timer)
      timer = null
      refCount = 0
    }
  }
}
