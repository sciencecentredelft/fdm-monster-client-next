<template>
  <div class="my-4">
    <div class="text-subtitle-2">Grid view password: {{ floor.gridProtected ? 'Protected' : 'Not set' }}</div>
    <p class="text-caption mb-3">Convenience lock only. Administrators bypass it; other printer views and APIs are not restricted.</p>
    <v-text-field
      v-model="password"
      type="password"
      autocomplete="new-password"
      label="New grid view password"
      hint="At least 8 characters, at most 72 UTF-8 bytes."
      persistent-hint
      :disabled="saving"
    />
    <v-btn :disabled="saving || !validPassword" :loading="saving" @click="save(password)">Set password</v-btn>
    <v-btn v-if="floor.gridProtected" variant="text" :disabled="saving" @click="save(null)">Remove password</v-btn>
    <v-alert v-if="message" class="mt-2" :type="failed ? 'error' : 'success'" variant="tonal">{{ message }}</v-alert>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FloorDto } from '@/models/floors/floor.model'
import { FloorService } from '@/backend/floor.service'
import { useFloorStore } from '@/store/floor.store'

const props = defineProps<{ floor: FloorDto }>()
const password = ref('')
const saving = ref(false)
const message = ref('')
const failed = ref(false)
const validPassword = computed(() => password.value.trim().length >= 8 &&
  new TextEncoder().encode(password.value).length <= 72)

async function save(value: string | null) {
  if (saving.value || (value !== null && !validPassword.value)) return
  saving.value = true
  message.value = ''
  failed.value = false
  try {
    const floor = await FloorService.setGridPassword(props.floor.id, value)
    useFloorStore()._replaceFloor(floor)
    password.value = ''
    message.value = value === null ? 'Grid view password removed.' : 'Grid view password saved.'
  } catch (error) {
    console.error('Failed to save floor grid password:', error)
    failed.value = true
    message.value = 'Could not save the grid view password. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>
