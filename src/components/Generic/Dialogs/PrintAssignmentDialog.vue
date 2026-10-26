<template>
  <BaseDialog :id="dialog.dialogId" max-width="480px" @before-opened="prepare" @escape="cancel">
    <v-card>
      <v-card-title>{{ assignmentEnabled ? 'Assign person to print' : 'Check printer status' }}</v-card-title>
      <v-card-text>
        <div v-for="(print, index) in prints" :key="index" class="mb-2">
          <div class="font-weight-medium">{{ print.fileName }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ print.printerName }}</div>
        </div>
        <div v-if="assignmentEnabled && prints.length > 1" class="text-body-2 mb-3">This person will be assigned to all {{ prints.length }} prints.</div>
        <template v-if="statusCheckEnabled">
          <div v-for="target in printerStatuses" :key="target.printerId" class="mb-3">
            <div class="d-flex align-center justify-space-between ga-2">
              <div role="status">{{ target.printerName }}: {{ target.label }}</div>
              <v-btn
                v-if="target.canReconnect && reconnectErrors[target.printerId] && !reconnecting[target.printerId]"
                size="small"
                variant="outlined"
                :aria-label="`Reconnect ${target.printerName}`"
                @click="reconnect(target.printerId)"
              >Reconnect</v-btn>
            </div>
            <div v-if="reconnecting[target.printerId]" class="text-body-2">
              Reconnecting. Waiting for live printer status...
            </div>
            <v-alert v-if="reconnectErrors[target.printerId]" type="warning" variant="tonal" class="mt-2">
              {{ reconnectErrors[target.printerId] }}
            </v-alert>
          </div>
          <v-alert v-if="!allPrintersReady" type="warning" variant="tonal" class="mb-3">
            {{ printerStatuses.length === 1
              ? 'The printer must be connected, enabled, and idle before starting.'
              : 'All printers must be connected, enabled, and idle before starting.' }}
          </v-alert>
        </template>
        <v-progress-linear v-if="loading" indeterminate aria-label="Loading previous assignment" class="mb-3" />
        <v-alert v-if="historyError" type="warning" variant="tonal" class="mb-3">
          Could not load previous assignments. Enter a name manually or
          <v-btn variant="text" size="small" @click="loadPreviousAssignment">Retry</v-btn>.
        </v-alert>
        <v-form @submit.prevent="confirm">
          <v-text-field
            v-if="assignmentEnabled"
            v-model="assignedTo"
            label="Assigned to"
            aria-label="Assigned to"
            :disabled="loading"
            :rules="[name => !!name?.trim() || 'Enter a name', name => name.trim().length <= 100 || 'Use at most 100 characters']"
            maxlength="100"
            counter="100"
            autofocus
            variant="outlined"
            class="mt-3"
          />
          <div class="d-flex justify-end mt-2">
            <v-btn variant="text" @click="cancel">Cancel</v-btn>
            <v-btn type="submit" color="success" :disabled="!canConfirm">Start print</v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BaseDialog from '@/components/Generic/Dialogs/BaseDialog.vue'
import { DialogName } from '@/components/Generic/Dialogs/dialog.constants'
import type { PrintAssignmentContext } from '@/components/Generic/Dialogs/dialog.types'
import { useDialog } from '@/shared/dialog.composable'
import { PrinterRemoteFileService } from '@/backend/printer-remote-file.service'
import { PrintersService } from '@/backend/printers.service'
import { usePrinterStore } from '@/store/printer.store'
import { usePrinterStateStore } from '@/store/printer-state.store'
import { interpretStates } from '@/shared/printer-state.constants'
import { hasSerialConnection } from '@/shared/printer-capabilities.constants'
import { useSettingsStore } from '@/store/settings.store'

const dialog = useDialog<DialogName.PrintAssignmentDialog, PrintAssignmentContext, string | null>(DialogName.PrintAssignmentDialog)
const printerStore = usePrinterStore()
const printerStateStore = usePrinterStateStore()
const prints = ref<PrintAssignmentContext['prints']>([])
const assignmentEnabled = ref(false)
const statusCheckEnabled = ref(false)
const active = ref(false)
const autoReconnectAttempted = ref<Record<number, boolean>>({})
const assignedTo = ref('')
const loading = ref(false)
const historyError = ref(false)
const validName = computed(() => assignedTo.value.trim().length > 0 && assignedTo.value.trim().length <= 100)
const reconnecting = ref<Record<number, boolean>>({})
const reconnectErrors = ref<Record<number, string>>({})
const reconnectTimers = new Map<number, ReturnType<typeof setTimeout>>()
let reconnectVersion = 0
let requestVersion = 0

const printerStatuses = computed(() => [...new Map(prints.value.map(print => [print.printerId, print])).values()].map(print => {
  const printer = printerStore.printer(print.printerId)
  const socket = printerStateStore.socketStatesById[print.printerId]
  const events = printerStateStore.printerEventsById[print.printerId]
  const flags = events?.current?.payload?.state?.flags
  const connected = socket?.api === 'responding' && socket?.socket === 'authenticated'
  const busy = !!(flags?.printing || flags?.paused || flags?.pausing || flags?.resuming ||
    flags?.cancelling || flags?.finishing || flags?.starting || flags?.updating)
  const ready = !!(printer?.enabled && connected && flags?.operational &&
    !flags.error && !flags.closedOrError && !busy)
  const offline = !connected || !flags?.operational || flags?.error || flags?.closedOrError
  return {
    printerId: print.printerId,
    printerName: printer?.name ?? print.printerName,
    ready,
    label: !printer ? 'Printer unavailable' : ready ? 'Ready' :
      busy && connected && printer.enabled ? 'Busy' : interpretStates(printer, socket, events)?.text ?? 'Unknown state',
    canReconnect: !!(printer?.enabled && offline && (!connected || !busy))
  }
}))
const allPrintersReady = computed(() => printerStatuses.value.length > 0 &&
  printerStatuses.value.every(target => target.ready && !reconnecting.value[target.printerId]))
const canConfirm = computed(() => !loading.value && (!assignmentEnabled.value || validName.value) &&
  (!statusCheckEnabled.value || allPrintersReady.value))

function finishReconnect(printerId: number) {
  clearTimeout(reconnectTimers.get(printerId))
  reconnectTimers.delete(printerId)
  delete reconnecting.value[printerId]
}

function resetReconnects() {
  reconnectVersion++
  for (const printerId of reconnectTimers.keys()) finishReconnect(printerId)
  reconnecting.value = {}
  reconnectErrors.value = {}
}

watch([printerStatuses, active], ([targets, isActive]) => {
  if (!isActive || !statusCheckEnabled.value) return
  for (const target of targets) {
    if (target.ready) {
      finishReconnect(target.printerId)
      delete reconnectErrors.value[target.printerId]
    } else if (target.canReconnect && !autoReconnectAttempted.value[target.printerId]) {
      autoReconnectAttempted.value[target.printerId] = true
      void reconnect(target.printerId)
    } else if (target.canReconnect && !reconnecting.value[target.printerId] && !reconnectErrors.value[target.printerId]) {
      reconnectErrors.value[target.printerId] = 'Printer connection was lost again. Check its power, network, and connection settings, then retry.'
    }
  }
})

async function reconnect(printerId: number) {
  const target = printerStatuses.value.find(target => target.printerId === printerId)
  if (!target?.canReconnect || reconnecting.value[printerId]) return
  const printer = printerStore.printer(printerId)
  if (!printer) return
  const version = reconnectVersion
  reconnecting.value[printerId] = true
  delete reconnectErrors.value[printerId]
  const timer = setTimeout(() => {
    finishReconnect(printerId)
    reconnectErrors.value[printerId] = 'Printer is still not ready. Check its power, network, and connection settings, then retry.'
  }, 20000)
  reconnectTimers.set(printerId, timer)
  try {
    const flags = printerStateStore.printerEventsById[printerId]?.current?.payload?.state?.flags
    if (hasSerialConnection(printer.printerType) &&
      printerStateStore.socketStatesById[printerId]?.api === 'responding' &&
      printerStateStore.socketStatesById[printerId]?.socket === 'authenticated' &&
      flags && !flags.operational) {
      await PrintersService.sendPrinterConnectCommand(printerId)
    } else {
      await PrintersService.refreshSocket(printerId)
    }
  } catch (error) {
    if (version !== reconnectVersion || reconnectTimers.get(printerId) !== timer) return
    console.error(`Failed to reconnect printer ${printerId}:`, error)
    finishReconnect(printerId)
    reconnectErrors.value[printerId] = 'Could not reconnect the printer. Check its connection and try again.'
  }
}

function prepare(context: PrintAssignmentContext) {
  active.value = false
  resetReconnects()
  autoReconnectAttempted.value = {}
  const settings = useSettingsStore().serverSettings
  assignmentEnabled.value = settings?.printAssignmentEnabled === true
  statusCheckEnabled.value = settings?.checkPrinterStatusBeforePrint === true
  prints.value = context.prints
  assignedTo.value = ''
  active.value = true
  void loadPreviousAssignment()
}

async function loadPreviousAssignment() {
  const version = ++requestVersion
  historyError.value = false
  const targets = [...prints.value]
  loading.value = assignmentEnabled.value && targets.some(print => print.existingFile)
  if (!loading.value) return
  try {
    const printerIds = [...new Set(targets.filter(print => print.existingFile).map(print => print.printerId))]
    const histories = new Map(await Promise.all(printerIds.map(async printerId =>
      [printerId, await PrinterRemoteFileService.getLastPrintStarts(printerId)] as const
    )))
    if (version !== requestVersion) return
    const names = targets.map(print => print.existingFile
      ? histories.get(print.printerId)?.find(job => job.fileName === print.fileName)?.assignedTo
      : null)
    if (names[0] && names.every(name => name === names[0])) assignedTo.value = names[0]
  } catch (error) {
    if (version !== requestVersion) return
    console.error('Failed to load previous print assignments:', error)
    historyError.value = true
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

function cancel() {
  active.value = false
  requestVersion++
  resetReconnects()
  dialog.closeDialog(null)
}

function confirm() {
  if (!canConfirm.value) return
  active.value = false
  resetReconnects()
  dialog.closeDialog(assignmentEnabled.value ? assignedTo.value.trim() : '')
}

onBeforeUnmount(() => {
  active.value = false
  requestVersion++
  resetReconnects()
})
</script>
