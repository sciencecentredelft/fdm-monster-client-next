import type { PrinterDto } from '@/models/printers/printer.model'
import type { PrinterStateDto, SocketState } from '@/models/socketio-messages/socketio-message.model'

export const defaultGridStatusColors = {
  ready: '#2E7D32',
  printing: '#1565C0',
  paused: '#FFB300',
  offline: '#616161',
  connecting: '#7B1FA2',
  error: '#C62828',
  disabled: '#303030',
  maintenance: '#EF6C00'
}

export type GridStatusColors = typeof defaultGridStatusColors
export type GridStatus = keyof GridStatusColors

export const gridStatusLabels: Record<GridStatus, string> = {
  ready: 'Ready / idle',
  printing: 'Printing',
  paused: 'Paused',
  offline: 'Offline / disconnected',
  connecting: 'Connecting / unknown',
  error: 'Error',
  disabled: 'Disabled',
  maintenance: 'Maintenance'
}

export function getGridStatus(
  printer: PrinterDto,
  socket?: SocketState,
  events?: PrinterStateDto
): GridStatus {
  if (!printer.enabled) return printer.disabledReason ? 'maintenance' : 'disabled'
  if (socket?.api === 'authFail' || socket?.api === 'globalKey') return 'error'
  if (socket?.api === 'noResponse') return 'offline'
  if (socket?.api !== 'responding') return 'connecting'
  if (socket.socket === 'error') return 'error'
  if (socket.socket !== 'authenticated') {
    return socket.socket === 'closed' || socket.socket === 'aborted' ? 'offline' : 'connecting'
  }
  const flags = events?.current?.payload?.state?.flags
  if (!flags) return 'connecting'
  if (flags.error) return 'error'
  if (flags.closedOrError) return 'offline'
  if (flags.paused || flags.pausing) return 'paused'
  if (flags.printing || flags.starting || flags.resuming || flags.finishing || flags.cancelling) return 'printing'
  return flags.operational && !flags.updating ? 'ready' : 'connecting'
}

export function gridStatusTextColor(background: string): '#000000' | '#FFFFFF' {
  const channels = [1, 3, 5].map(index => {
    const value = parseInt(background.slice(index, index + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#FFFFFF'
}
