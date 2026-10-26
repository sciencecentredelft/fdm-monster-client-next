<template>
  <div class="advanced-file-list">
    <v-text-field
      v-model="search"
      aria-label="Search files"
      placeholder="Search visible columns..."
      prepend-inner-icon="search"
      variant="outlined"
      density="compact"
      clearable
      hide-details
      class="mb-3 flex-shrink-0"
    />
    <v-alert v-if="historyError" type="error" variant="tonal" density="compact" class="mb-2">
      Could not load print history.
      <v-btn variant="text" size="small" @click="loadPrintStarts">Retry</v-btn>
    </v-alert>
    <v-data-table-virtual
      v-model:sort-by="sortBy"
      :headers="headers"
      :items="filteredFiles"
      :loading="loading || historyLoading"
      item-value="path"
      density="compact"
      fixed-header
      height="100%"
      no-data-text="No matching files"
    >
      <template #item.name="{ item }">
        <v-btn
          v-if="item.file.dir"
          variant="text"
          size="small"
          prepend-icon="folder"
          :title="item.path"
          @click="emit('navigate', item.path)"
        >
          {{ item.name }}
        </v-btn>
        <span
          v-else
          :title="item.path"
          :class="{ 'text-primary font-weight-bold': item.path === currentPrintingFilePath }"
        >
          {{ item.name }}
        </span>
      </template>
      <template #item.size="{ item }">
        {{ item.file.dir ? '-' : formatFileSize(item.file.size ?? undefined) }}
      </template>
      <template #item.startedAt="{ item }">
        <span :title="item.dateTitle">
          {{ item.dateLabel }}
        </span>
      </template>
      <template #item.assignedTo="{ item }">
        {{ item.assignmentLabel }}
      </template>
      <template #item.actions="{ item }">
        <div v-if="!item.file.dir" class="d-flex">
          <v-btn
            icon="download"
            aria-label="Download file"
            size="x-small"
            variant="text"
            @click="emit('download', item.path)"
          />
          <v-btn
            icon="play_arrow"
            aria-label="Print file"
            size="x-small"
            variant="text"
            color="success"
            :disabled="item.path === currentPrintingFilePath"
            @click="emit('print', item.file)"
          />
          <v-btn
            icon="delete"
            aria-label="Delete file"
            size="x-small"
            variant="text"
            color="error"
            :disabled="item.path === currentPrintingFilePath"
            @click="emit('delete', item.file)"
          />
        </div>
      </template>
    </v-data-table-virtual>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { PrinterRemoteFileService } from '@/backend/printer-remote-file.service'
import type { FileDto, LastPrintStartDto } from '@/models/printers/printer-file.model'
import { formatFileSize } from '@/utils/file-size.util'
import type { AdvancedFileListColumns } from '@/models/settings/server-settings.dto'

const props = withDefaults(defineProps<{
  files: FileDto[]
  printerId: number
  loading?: boolean
  currentPrintingFilePath?: string | null
  columns?: AdvancedFileListColumns
}>(), {
  columns: () => ({ size: true, startedAt: true })
})
const emit = defineEmits<{
  navigate: [path: string]
  download: [path: string]
  print: [file: FileDto]
  delete: [file: FileDto]
}>()

const headers = computed(() => [
  { title: 'Name', key: 'name' },
  { title: 'Size', key: 'size' },
  { title: 'Last print started', key: 'startedAt' },
  { title: 'Assigned to', key: 'assignedTo' },
  { title: 'Actions', key: 'actions', sortable: false }
].filter(header => {
  if (header.key === 'size') return props.columns.size
  if (header.key === 'startedAt') return props.columns.startedAt
  if (header.key === 'assignedTo') return props.columns.assignedTo === true
  return true
}))
const sortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'name', order: 'asc' }])
const search = ref<string | null>('')
const printStarts = ref<LastPrintStartDto[]>([])
const historyLoading = ref(false)
const historyError = ref(false)
let requestVersion = 0

async function loadPrintStarts() {
  const version = ++requestVersion
  printStarts.value = []
  historyError.value = false
  if (!props.columns.startedAt && !props.columns.assignedTo) {
    historyLoading.value = false
    return
  }
  historyLoading.value = true
  try {
    const starts = await PrinterRemoteFileService.getLastPrintStarts(props.printerId)
    if (version === requestVersion) printStarts.value = starts
  } catch (error) {
    if (version !== requestVersion) return
    console.error('Failed to load print start dates:', error)
    historyError.value = true
  } finally {
    if (version === requestVersion) historyLoading.value = false
  }
}

watch(() => [props.printerId, props.files, props.columns.startedAt, props.columns.assignedTo, props.currentPrintingFilePath], loadPrintStarts, { immediate: true })
watch(() => props.printerId, () => {
  search.value = ''
})
watch(headers, visibleHeaders => {
  if (sortBy.value.some(sort => !visibleHeaders.some(header => header.key === sort.key))) {
    sortBy.value = [{ key: 'name', order: 'asc' }]
  }
})
onBeforeUnmount(() => { requestVersion++ })

const filteredFiles = computed(() => {
  const startsByPath = new Map(printStarts.value.map(start => [start.fileName, Date.parse(start.startedAt)]))
  const assignmentsByPath = new Map(printStarts.value.map(start => [start.fileName, start.assignedTo]))
  const matches = (text: string, query: string | null) =>
    text.toLowerCase().includes((query ?? '').trim().toLowerCase())

  return props.files.map(file => {
    const startedAt = file.dir ? null : startsByPath.get(file.path) ?? null
    const date = startedAt === null ? null : new Date(startedAt)
    let dateLabel = 'Not recorded'
    if (historyLoading.value) dateLabel = 'Loading...'
    if (historyError.value) dateLabel = 'Unavailable'
    if (date) dateLabel = date.toLocaleDateString()
    if (file.dir) dateLabel = '-'
    const assignedTo = file.dir ? null : assignmentsByPath.get(file.path) ?? null
    const assignmentLabel = file.dir ? '-' : historyLoading.value ? 'Loading...'
      : historyError.value ? 'Unavailable' : assignedTo || 'Not assigned'

    return {
      file,
      path: file.path,
      name: file.path.split('/').pop() || file.path,
      size: file.size,
      startedAt,
      assignedTo,
      assignmentLabel,
      dateLabel,
      dateTitle: date?.toLocaleString(),
      dateSearchText: date ? `${dateLabel} ${date.toLocaleString()} ${date.toISOString()}` : dateLabel
    }
  }).filter(item => {
    return matches(item.name, search.value)
      || (props.columns.size && !item.file.dir
        && matches(`${item.size ?? ''} ${formatFileSize(item.size ?? undefined)}`, search.value))
      || (props.columns.startedAt && !item.file.dir && matches(item.dateSearchText, search.value))
      || (props.columns.assignedTo && !item.file.dir && matches(item.assignmentLabel, search.value))
  })
})
</script>

<style scoped>
.advanced-file-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.advanced-file-list :deep(.v-table) {
  flex: 1 1 0;
  min-height: 0;
}
</style>
