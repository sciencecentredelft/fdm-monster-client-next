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
        </div>
        <v-progress-linear v-if="saving" indeterminate aria-label="Saving advanced file list settings" />
        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-2">
          {{ errorMessage }}
          <v-btn v-if="!loaded" variant="text" @click="loadSettings">Retry</v-btn>
        </v-alert>
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

const settingsStore = useSettingsStore()
const enabled = ref(false)
const columns = ref<AdvancedFileListColumns>({ size: true, startedAt: true })
const loading = ref(true)
const loaded = ref(false)
const saving = ref(false)
const errorMessage = ref('')
let savedEnabled = false
let savedColumns: AdvancedFileListColumns = { size: true, startedAt: true }

function applySettings(settings: SettingsDto) {
  settingsStore.settings = settings
  savedEnabled = settings.server.advancedFileListEnabled === true
  savedColumns = { ...settings.server.advancedFileListColumns ?? { size: true, startedAt: true } }
  enabled.value = savedEnabled
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

onMounted(loadSettings)
</script>
