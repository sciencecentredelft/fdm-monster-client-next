<template>
  <span ref="container" class="middle-truncated-name" :aria-label="text">
    <span>{{ displayedText }}</span>
    <span ref="measurement" class="name-measurement" aria-hidden="true" />
  </span>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { middleTruncate } from '@/utils/middle-truncate.util'

const props = defineProps<{ text: string }>()
const container = ref<HTMLElement>()
const measurement = ref<HTMLElement>()
const displayedText = ref(props.text)
let observer: ResizeObserver | undefined

function updateText() {
  const element = container.value
  const measureElement = measurement.value
  if (!element || !measureElement) return
  const width = element.getBoundingClientRect().width
  if (width <= 0) {
    displayedText.value = props.text
    return
  }
  displayedText.value = middleTruncate(props.text, width, text => {
    measureElement.textContent = text
    return measureElement.getBoundingClientRect().width
  })
  measureElement.textContent = ''
}

onMounted(() => {
  observer = new ResizeObserver(updateText)
  if (container.value) observer.observe(container.value)
  updateText()
})
watch(() => props.text, updateText, { flush: 'post' })
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.middle-truncated-name {
  display: block;
  min-width: 0;
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
}

.name-measurement {
  position: fixed;
  visibility: hidden;
  pointer-events: none;
  white-space: pre;
}
</style>
