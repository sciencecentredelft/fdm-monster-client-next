<template>
  <SettingSection title="User directory API" :usecols="false" collapsible>
    <v-progress-linear v-if="loading || saving" indeterminate aria-label="Loading user directory settings" />
    <div class="d-flex flex-wrap ga-2 mb-3">
      <v-btn
        color="primary"
        :disabled="!canSave || refreshing || testing"
        :loading="saving"
        @click="saveSettings"
      >Save directory settings</v-btn>
      <v-btn
        variant="outlined"
        :disabled="!config.enabled || !loaded || saving || testing || refreshing || !saved"
        :loading="testing"
        @click="testConnection"
      >Test connection</v-btn>
      <v-btn
        variant="outlined"
        :disabled="!config.enabled || !loaded || saving || testing || refreshing || !saved"
        :loading="refreshing"
        @click="refreshUsers"
      >Refresh cached users</v-btn>
    </div>
    <v-alert v-if="successMessage" type="success" variant="tonal" class="mb-3">
      {{ successMessage }}
    </v-alert>
    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-3">
      {{ errorMessage }}
      <v-btn v-if="!loaded" variant="text" @click="loadSettings">Retry</v-btn>
    </v-alert>
    <v-alert type="info" variant="tonal" class="mb-3">
      When enabled, people are selected from this API before a print starts. Credentials are sent by the server and are
      never returned to the browser. Manual name entry can be disabled below to require an API user.
      Users are cached on the server for 24 hours and reloaded on the next lookup after expiry or a server restart.
      Save changed settings before refreshing. Testing the connection also refreshes the cache.
    </v-alert>
    <v-checkbox
      v-model="config.enabled"
      label="Enable user directory API"
      :disabled="loading || saving || !loaded"
      hide-details
    />
    <div v-if="config.enabled" class="ml-4">
      <v-checkbox
        v-model="config.allowManualEntry"
        label="Allow manual assignee names"
        hint="When disabled, a person must be selected from the API. Printing is blocked if the directory cannot be loaded."
        persistent-hint
        :disabled="loading || saving || !loaded"
      />
      <v-text-field
        v-model="config.endpoint"
        label="Users endpoint URL"
        type="url"
        placeholder="https://example.com/api/users"
        :disabled="loading || saving || !loaded"
      />
      <v-select
        v-model="config.method"
        :items="['GET', 'POST']"
        label="Users request method"
        :disabled="loading || saving || !loaded"
      />
      <v-select
        v-model="config.authMode"
        :items="authModes"
        item-title="title"
        item-value="value"
        label="Authentication"
        :disabled="loading || saving || !loaded"
      />
      <template v-if="config.authMode !== 'none'">
        <v-text-field
          v-model="config.clientId"
          label="Client ID"
          autocomplete="off"
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model="clientSecret"
          label="Client secret"
          type="password"
          autocomplete="new-password"
          :placeholder="hasClientSecret ? 'Saved; leave blank to keep current secret' : ''"
          :disabled="loading || saving || !loaded || clearClientSecret"
        />
        <v-checkbox
          v-if="hasClientSecret"
          v-model="clearClientSecret"
          label="Clear saved client secret"
          :disabled="loading || saving || !loaded"
          hide-details
        />
        <v-text-field
          v-model="config.clientIdField"
          label="Client ID field name"
          hint="Used for direct credentials, and for OAuth2 JSON/form token requests."
          persistent-hint
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model="config.clientSecretField"
          label="Client secret field name"
          :disabled="loading || saving || !loaded"
        />
      </template>
      <template v-if="config.authMode === 'credentials'">
        <v-select
          v-model="config.credentialPlacement"
          :items="credentialPlacements"
          item-title="title"
          item-value="value"
          label="Send credentials in"
          :disabled="loading || saving || !loaded"
        />
      </template>
      <template v-if="config.authMode === 'oauth2'">
        <v-text-field
          v-model="config.tokenEndpoint"
          label="OAuth2 token endpoint URL"
          type="url"
          :disabled="loading || saving || !loaded"
        />
        <v-select
          v-model="config.tokenCredentialPlacement"
          :items="tokenPlacements"
          item-title="title"
          item-value="value"
          label="Send client credentials in token request"
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model="config.scope"
          label="OAuth2 scope (optional)"
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model="config.accessTokenPath"
          label="Access token JSON path"
          hint="For example: access_token or data.token"
          persistent-hint
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model="config.tokenTypePath"
          label="Token type JSON path"
          hint="Defaults to Bearer when missing."
          persistent-hint
          :disabled="loading || saving || !loaded"
        />
      </template>
      <v-text-field
        v-model="config.usersPath"
        label="Users array JSON path"
        hint="For example: data.users, or results for a paginated directory."
        persistent-hint
        :disabled="loading || saving || !loaded"
      />
      <v-checkbox
        v-model="config.paginationEnabled"
        label="Fetch all numbered pages"
        hint="GET query parameters, starting at page 1. Limited to 100 pages, 10,000 users and 30 seconds per lookup."
        persistent-hint
        :disabled="loading || saving || !loaded"
      />
      <div v-if="config.paginationEnabled" class="ml-4">
        <v-alert v-if="config.method !== 'GET'" type="warning" variant="tonal" class="mb-3">
          Select GET as the users request method to use numbered pagination.
        </v-alert>
        <v-text-field
          v-model="config.pageNumberParameter"
          label="Page number query parameter"
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model="config.pageSizeParameter"
          label="Page size query parameter"
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model.number="config.pageSize"
          label="Users per page"
          type="number"
          min="1"
          max="1000"
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model="config.countPath"
          label="Total count JSON path"
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model="config.pageNumberPath"
          label="Page number JSON path"
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model="config.pageSizePath"
          label="Page size JSON path"
          :disabled="loading || saving || !loaded"
        />
      </div>
      <v-checkbox
        v-model="config.combineNames"
        label="Combine first and last names"
        hint="Join non-empty name parts with a space. At least one name part is required for each person."
        persistent-hint
        :disabled="loading || saving || !loaded"
      />
      <template v-if="config.combineNames">
        <v-text-field
          v-model="config.firstNamePath"
          label="First name JSON path"
          :disabled="loading || saving || !loaded"
        />
        <v-text-field
          v-model="config.lastNamePath"
          label="Last name JSON path"
          :disabled="loading || saving || !loaded"
        />
      </template>
      <v-text-field
        v-else
        v-model="config.namePath"
        label="Person name JSON path"
        hint="Path relative to each user item, for example: profile.full_name"
        persistent-hint
        :disabled="loading || saving || !loaded"
      />
      <v-text-field
        v-model="config.emailPath"
        label="Person email JSON path"
        hint="Path relative to each user item, for example: contact.email"
        persistent-hint
        :disabled="loading || saving || !loaded"
      />
    </div>
  </SettingSection>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { SettingsService } from '@/backend/settings.service'
import SettingSection from '@/components/Settings/Shared/SettingSection.vue'
import { defaultUserDirectoryConfig, type UserDirectoryConfig } from '@/models/settings/user-directory.dto'
import { useSettingsStore } from '@/store/settings.store'

const settingsStore = useSettingsStore()
const config = ref<UserDirectoryConfig>({ ...defaultUserDirectoryConfig })
const clientSecret = ref('')
const hasClientSecret = ref(false)
const clearClientSecret = ref(false)
const loading = ref(true)
const loaded = ref(false)
const saving = ref(false)
const testing = ref(false)
const refreshing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const savedConfig = ref('')
const saved = computed(() => loaded.value && JSON.stringify(config.value) === savedConfig.value &&
  clientSecret.value === '' && !clearClientSecret.value)
const authModes = [
  { title: 'No authentication', value: 'none' },
  { title: 'Client ID and secret', value: 'credentials' },
  { title: 'OAuth2 client credentials', value: 'oauth2' }
]
const credentialPlacements = [
  { title: 'HTTP headers', value: 'header' },
  { title: 'Query parameters', value: 'query' },
  { title: 'JSON request body', value: 'json' },
  { title: 'Form request body', value: 'form' }
]
const tokenPlacements = [
  { title: 'HTTP Basic authentication', value: 'basic' },
  { title: 'JSON request body', value: 'json' },
  { title: 'Form request body', value: 'form' }
]
const validPath = (path: string) =>
  /^(?:[A-Za-z0-9_-]+|\[\d+\])(?:\.(?:[A-Za-z0-9_-]+)|\[\d+\])*$/.test(path.replace(/^\$\.?/, ''))
const validUrl = (value: string) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash
  } catch {
    return false
  }
}
const canSave = computed(() => {
  if (loading.value || saving.value || !loaded.value) return false
  if (config.value.enabled && config.value.authMode !== 'none' && clearClientSecret.value) return false
  if (!config.value.enabled) return true
  if (!validUrl(config.value.endpoint)) return false
  const namePaths = config.value.combineNames
    ? [config.value.firstNamePath, config.value.lastNamePath]
    : [config.value.namePath]
  if (![config.value.usersPath, config.value.emailPath, ...namePaths].every(validPath)) return false
  if (config.value.paginationEnabled) {
    if (config.value.method !== 'GET' || !Number.isInteger(config.value.pageSize) ||
      config.value.pageSize < 1 || config.value.pageSize > 1000) return false
    if (![config.value.countPath, config.value.pageNumberPath, config.value.pageSizePath].every(validPath)) return false
    const parameters = [config.value.pageNumberParameter, config.value.pageSizeParameter]
    if (!parameters.every(value => /^[A-Za-z0-9_.-]{1,128}$/.test(value)) || parameters[0] === parameters[1]) return false
    if (config.value.authMode === 'credentials' && config.value.credentialPlacement === 'query' &&
      [config.value.clientIdField, config.value.clientSecretField].some(field => parameters.includes(field))) return false
  }
  if (config.value.authMode !== 'none' &&
    (!config.value.clientId.trim() || !/^[A-Za-z0-9_.-]{1,128}$/.test(config.value.clientIdField) ||
      !/^[A-Za-z0-9_.-]{1,128}$/.test(config.value.clientSecretField) ||
      (!hasClientSecret.value && !clientSecret.value))) return false
  if (config.value.authMode === 'credentials' &&
    ['json', 'form'].includes(config.value.credentialPlacement) && config.value.method !== 'POST') return false
  if (config.value.authMode === 'oauth2' &&
    (!validUrl(config.value.tokenEndpoint) || !validPath(config.value.accessTokenPath) ||
      !validPath(config.value.tokenTypePath))) return false
  return true
})

async function loadSettings() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await SettingsService.getUserDirectorySettings()
    config.value = { ...defaultUserDirectoryConfig, ...result.config }
    hasClientSecret.value = result.hasClientSecret
    savedConfig.value = JSON.stringify(config.value)
    loaded.value = true
  } catch (error) {
    console.error('Failed to load user directory settings:', error)
    errorMessage.value = 'Could not load user directory settings. Please try again.'
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  if (!canSave.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await SettingsService.updateUserDirectorySettings(
      { ...config.value },
      clientSecret.value || undefined,
      clearClientSecret.value
    )
    config.value = { ...defaultUserDirectoryConfig, ...result.config }
    hasClientSecret.value = result.hasClientSecret
    clientSecret.value = ''
    clearClientSecret.value = false
    savedConfig.value = JSON.stringify(config.value)
    if (settingsStore.settings) {
      settingsStore.settings.server.userDirectoryApiEnabled = config.value.enabled
      settingsStore.settings.server.userDirectoryManualEntryAllowed = config.value.allowManualEntry
    }
    successMessage.value = 'User directory settings saved.'
  } catch (error) {
    console.error('Failed to save user directory settings:', error)
    errorMessage.value = 'Could not save user directory settings. Check the configuration and try again.'
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  testing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await SettingsService.testUserDirectoryConnection()
    successMessage.value = `Connection successful. Found ${result.userCount} people.`
  } catch (error) {
    console.error('User directory connection test failed:', error)
    errorMessage.value = 'Could not load the complete user directory. Check its URL, credentials, response paths, and pagination settings.'
  } finally {
    testing.value = false
  }
}

async function refreshUsers() {
  refreshing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await SettingsService.refreshUserDirectoryUsers()
    successMessage.value = `User cache refreshed. Loaded ${result.userCount} people.`
  } catch (error) {
    console.error('User directory cache refresh failed:', error)
    errorMessage.value = 'Could not refresh the user cache. Check the directory configuration and try again.'
  } finally {
    refreshing.value = false
  }
}

onMounted(loadSettings)
</script>
