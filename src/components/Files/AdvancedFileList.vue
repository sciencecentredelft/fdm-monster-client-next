<template>
  <div class="advanced-file-list">
    <v-menu :close-on-content-click="false">
      <template #activator="{ props: menuProps }">
        <v-btn v-bind="menuProps" variant="text" size="small" class="align-self-end mb-2">
          Column widths
        </v-btn>
      </template>
      <v-card width="320" class="pa-4">
        <v-card-title class="pa-0 mb-3">Column widths</v-card-title>
        <v-slider
          v-for="header in headers"
          :key="header.key"
          v-model="columnWidths[header.key]"
          :label="header.title"
          :aria-label="`${header.title} column width`"
          :min="columnDefinitions[header.key].min"
          :max="600"
          :step="10"
          thumb-label
          hide-details
        />
        <p class="text-caption mt-2">Relative widths, saved in this browser. Columns scale to fit the panel.</p>
        <v-btn variant="text" size="small" class="mt-2" @click="columnWidths = { ...defaultColumnWidths }">
          Reset widths
        </v-btn>
      </v-card>
    </v-menu>
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
          class="folder-name"
          @click="emit('navigate', item.path)"
        >
          <MiddleTruncatedName :text="item.name" />
        </v-btn>
        <span
          v-else
          :title="item.path"
          :class="{ 'text-primary font-weight-bold': item.path === currentPrintingFilePath }"
        >
          <MiddleTruncatedName :text="item.name" />
        </span>
      </template>
      <template #item.size="{ item }">
        <span class="column-text" :title="item.file.dir ? '-' : formatFileSize(item.file.size ?? undefined)">
          {{ item.file.dir ? '-' : formatFileSize(item.file.size ?? undefined) }}
        </span>
      </template>
      <template #item.startedAt="{ item }">
        <span class="column-text" :title="item.dateTitle">
          {{ item.dateLabel }}
        </span>
      </template>
      <template #item.assignedTo="{ item }">
        <span class="column-text" :title="item.assignmentLabel">{{ item.assignmentLabel }}</span>
      </template>
      <template #item.actions="{ item }">
        <div v-if="!item.file.dir" class="file-actions">
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
import { useLocalStorage } from '@vueuse/core'
import MiddleTruncatedName from '@/components/Files/MiddleTruncatedName.vue'

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

const columnDefinitions = {
  name: { title: 'Name', min: 100 },
  size: { title: 'Size', min: 80 },
  startedAt: { title: 'Last print started', min: 140 },
  assignedTo: { title: 'Assigned to', min: 120 },
  actions: { title: 'Actions', min: 120 }
}
type ColumnKey = keyof typeof columnDefinitions
type ColumnWidths = Record<ColumnKey, number>
const columnKeys: ColumnKey[] = ['name', 'size', 'startedAt', 'assignedTo', 'actions']
const defaultColumnWidths: ColumnWidths = { name: 280, size: 100, startedAt: 180, assignedTo: 180, actions: 120 }
const columnWidths = useLocalStorage<ColumnWidths>('advanced-file-list-column-widths', { ...defaultColumnWidths }, {
  serializer: {
    read: value => {
      const saved: unknown = JSON.parse(value)
      if (!saved || typeof saved !== 'object') throw new Error('Invalid saved file column widths')
      const widths = { ...defaultColumnWidths }
      for (const key of columnKeys) {
        const width: unknown = Reflect.get(saved, key)
        if (width === undefined) continue
        if (typeof width !== 'number' || !Number.isFinite(width) || width < columnDefinitions[key].min || width > 600) {
          throw new Error(`Invalid saved width for ${key}`)
        }
        widths[key] = width
      }
      return widths
    },
    write: value => JSON.stringify(value)
  },
  onError: error => console.error('Could not persist advanced file column widths:', error)
})
const visibleColumnKeys = computed(() => columnKeys.filter(key => {
  if (key === 'size') return props.columns.size
  if (key === 'startedAt') return props.columns.startedAt
  if (key === 'assignedTo') return props.columns.assignedTo === true
  return true
}))
const headers = computed(() => {
  const totalWidth = visibleColumnKeys.value.reduce((total, key) => total + columnWidths.value[key], 0)
  return visibleColumnKeys.value.map(key => ({
    title: columnDefinitions[key].title,
    key,
    width: `${columnWidths.value[key] / totalWidth * 100}%`,
    sortable: key !== 'actions'
  }))
})
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
  min-width: 0;
}

.advanced-file-list :deep(.v-table) {
  flex: 1 1 0;
  min-height: 0;
}

.advanced-file-list :deep(table) {
  table-layout: fixed;
  width: 100%;
}

.advanced-file-list :deep(th),
.advanced-file-list :deep(td) {
  overflow: hidden;
  padding-inline: 8px !important;
}

.advanced-file-list :deep(.v-data-table-header__content) {
  min-width: 0;
}

.advanced-file-list :deep(.v-data-table-header__content > span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-actions {
  display: flex;
  flex-wrap: wrap;
}

.file-actions :deep(.v-btn) {
  flex-shrink: 0;
}

.column-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-name {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.folder-name :deep(.v-btn__content) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
</style>
