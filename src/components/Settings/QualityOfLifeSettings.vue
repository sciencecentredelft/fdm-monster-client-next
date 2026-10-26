<template>
  <v-card>
    <v-card-text>
      <SettingSection title="Advanced printer file list" :usecols="false">
        <v-progress-linear v-if="loading" indeterminate aria-label="Loading quality of life settings" />
        <v-checkbox
          v-model="enabled"
          :disabled="loading || saving || !loaded"
          label="Enable advanced file list"
          :hint="enabled ? 'Show sortable columns and one search field across visible columns.' : undefined"
          :persistent-hint="enabled"
          :hide-details="!enabled"
          @update:model-value="save"
        />
        <div v-if="enabled" class="ml-4">
          <div class="text-body-2 mt-3">Displayed columns (Name and Actions are always shown)</div>
          <v-checkbox
            v-model="columns.size"
            :disabled="loading || saving || !loaded"
            label="Show Size column"
            hide-details
            @update:model-value="save"
          />
          <v-checkbox
            v-model="columns.startedAt"
            :disabled="loading || saving || !loaded"
            label="Show Last print started column"
            hide-details
            @update:model-value="save"
          />
          <v-checkbox
            v-model="columns.assignedTo"
            :disabled="loading || saving || !loaded"
            label="Show Assigned to column (latest print)"
            hide-details
            @update:model-value="save"
          />
        </div>
        <v-progress-linear v-if="saving" indeterminate aria-label="Saving advanced file list settings" />
        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-2">
          {{ errorMessage }}
          <v-btn v-if="!loaded" variant="text" @click="loadSettings">Retry</v-btn>
        </v-alert>
      </SettingSection>
      <SettingSection title="Print assignment" :usecols="false">
        <v-checkbox
          v-model="assignmentEnabled"
          :disabled="loading || saving || !loaded"
          label="Assign a person before printing"
          hint="Require a name before file prints, Upload and Print, or batch reprints. Queued and externally started prints are unchanged."
          persistent-hint
          @update:model-value="saveAssignment"
        />
        <v-checkbox
          v-model="showAssigneeOnGrid"
          :disabled="loading || saving || !loaded"
          label="Show assignee on printer grid cards"
          hint="Show the current print's assigned person while printing or paused."
          persistent-hint
          @update:model-value="saveGridDisplay"
        />
      </SettingSection>
      <SettingSection title="Pre-print status check" :usecols="false">
        <v-checkbox
          v-model="statusCheckEnabled"
          :disabled="loading || saving || !loaded"
          label="Check printer status before printing"
          hint="Automatically try to reconnect offline printers and require them to be ready before continuing. Works independently of person assignment."
          persistent-hint
          @update:model-value="saveStatusCheck"
        />
      </SettingSection>
      <SettingSection title="Printer grid status colours" :usecols="false">
        <v-checkbox
          v-model="gridColorsEnabled"
          :disabled="loading || saving || !loaded"
          label="Colour-code printer grid cards"
          @update:model-value="saveGridColors"
        />
        <div v-if="gridColorsEnabled" class="ml-4">
          <label v-for="(label, status) in gridStatusLabels" :key="status" class="d-flex align-center ga-3 mb-3">
            <input
              v-model="gridColors[status]"
              type="color"
              :aria-label="`${label} colour`"
              :disabled="loading || saving || !loaded"
              @change="saveGridColors"
            />
            <span>{{ label }}</span>
          </label>
        </div>
      </SettingSection>
      <SettingSection title="Floor grid view locks" :usecols="false">
        <v-checkbox
          v-model="floorGridLockEnabled"
          :disabled="loading || saving || !loaded"
          label="Enable password locks for floor grid views"
          hint="Convenience lock only: printers remain accessible in lists and through APIs. Administrators bypass the lock."
          persistent-hint
          @update:model-value="saveFloorGridLock"
        />
        <div v-if="floorGridLockEnabled" class="text-body-2 ml-4">
          Set a password per group in Settings &gt; Floors. A password is required each time a protected grid is opened.
        </div>
      </SettingSection>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { SettingsService } from '@/backend'
import SettingSection from '@/components/Settings/Shared/SettingSection.vue'
import { useSettingsStore } from '@/store/settings.store'
import type { AdvancedFileListColumns } from '@/models/settings/server-settings.dto'
import type { SettingsDto } from '@/models/settings/settings.model'
import { defaultGridStatusColors, gridStatusLabels } from '@/shared/grid-status-colors'

const settingsStore = useSettingsStore()
const enabled = ref(false)
const assignmentEnabled = ref(false)
const showAssigneeOnGrid = ref(false)
const statusCheckEnabled = ref(false)
const gridColorsEnabled = ref(false)
const floorGridLockEnabled = ref(false)
const gridColors = ref({ ...defaultGridStatusColors })
const columns = ref<AdvancedFileListColumns>({ size: true, startedAt: true })
const loading = ref(true)
const loaded = ref(false)
const saving = ref(false)
const errorMessage = ref('')
let savedEnabled = false
let savedAssignmentEnabled = false
let savedShowAssigneeOnGrid = false
let savedStatusCheckEnabled = false
let savedGridColorsEnabled = false
let savedFloorGridLockEnabled = false
let savedGridColors = { ...defaultGridStatusColors }
let savedColumns: AdvancedFileListColumns = { size: true, startedAt: true }

function applySettings(settings: SettingsDto) {
  settingsStore.settings = settings
  savedEnabled = settings.server.advancedFileListEnabled === true
  savedColumns = { ...settings.server.advancedFileListColumns ?? { size: true, startedAt: true } }
  enabled.value = savedEnabled
  savedAssignmentEnabled = settings.server.printAssignmentEnabled === true
  assignmentEnabled.value = savedAssignmentEnabled
  savedShowAssigneeOnGrid = settings.server.showPrintAssigneeOnGrid === true
  showAssigneeOnGrid.value = savedShowAssigneeOnGrid
  savedStatusCheckEnabled = settings.server.checkPrinterStatusBeforePrint === true
  statusCheckEnabled.value = savedStatusCheckEnabled
  savedGridColorsEnabled = settings.server.gridStatusColorsEnabled === true
  savedGridColors = { ...defaultGridStatusColors, ...settings.server.gridStatusColors }
  gridColorsEnabled.value = savedGridColorsEnabled
  savedFloorGridLockEnabled = settings.server.floorGridLockEnabled === true
  floorGridLockEnabled.value = savedFloorGridLockEnabled
  gridColors.value = { ...savedGridColors }
  columns.value = { ...savedColumns }
}

async function loadSettings() {
  loading.value = true
  errorMessage.value = ''
  try {
    applySettings(await SettingsService.getSettings())
    loaded.value = true
  } catch (error) {
    console.error('Failed to load quality of life settings:', error)
    errorMessage.value = 'Could not load quality of life settings. Please try again.'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  errorMessage.value = ''
  try {
    applySettings(await SettingsService.updateAdvancedFileList(enabled.value, { ...columns.value }))
  } catch (error) {
    console.error('Failed to update advanced file list:', error)
    enabled.value = savedEnabled
    columns.value = { ...savedColumns }
    errorMessage.value = 'Could not save the advanced file list settings. Please try again.'
  } finally {
    saving.value = false
  }
}

async function saveAssignment() {
  saving.value = true
  errorMessage.value = ''
  try {
    applySettings(await SettingsService.updatePrintAssignment(assignmentEnabled.value))
  } catch (error) {
    console.error('Failed to update print assignment:', error)
    assignmentEnabled.value = savedAssignmentEnabled
    errorMessage.value = 'Could not save the print assignment setting. Please try again.'
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)

async function saveFloorGridLock() {
  saving.value = true
  errorMessage.value = ''
  try {
    applySettings(await SettingsService.updateFloorGridLock(floorGridLockEnabled.value))
  } catch (error) {
    console.error('Failed to update floor grid locks:', error)
    floorGridLockEnabled.value = savedFloorGridLockEnabled
    errorMessage.value = 'Could not save the floor grid lock setting. Please try again.'
  } finally {
    saving.value = false
  }
}

async function saveGridColors() {
  saving.value = true
  errorMessage.value = ''
  try {
    applySettings(await SettingsService.updateGridStatusColors(gridColorsEnabled.value, { ...gridColors.value }))
  } catch (error) {
    console.error('Failed to update printer grid colours:', error)
    gridColorsEnabled.value = savedGridColorsEnabled
    gridColors.value = { ...savedGridColors }
    errorMessage.value = 'Could not save the printer grid colours. Please try again.'
  } finally {
    saving.value = false
  }
}

async function saveStatusCheck() {
  saving.value = true
  errorMessage.value = ''
  try {
    applySettings(await SettingsService.updatePrePrintStatusCheck(statusCheckEnabled.value))
  } catch (error) {
    console.error('Failed to update pre-print status check:', error)
    statusCheckEnabled.value = savedStatusCheckEnabled
    errorMessage.value = 'Could not save the pre-print status check setting. Please try again.'
  } finally {
    saving.value = false
  }
}

async function saveGridDisplay() {
  saving.value = true
  errorMessage.value = ''
  try {
    applySettings(await SettingsService.updatePrintAssigneeGrid(showAssigneeOnGrid.value))
  } catch (error) {
    console.error('Failed to update grid assignee display:', error)
    showAssigneeOnGrid.value = savedShowAssigneeOnGrid
    errorMessage.value = 'Could not save the grid assignee display setting. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>
