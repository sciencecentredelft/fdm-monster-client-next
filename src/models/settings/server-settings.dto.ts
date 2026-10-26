import type { GridStatusColors } from '@/shared/grid-status-colors'

export interface AdvancedFileListColumns {
  size: boolean
  startedAt: boolean
  assignedTo?: boolean
}

export interface ServerSettingsDto {
  sentryDiagnosticsEnabled: boolean
  loginRequired: boolean
  registration: boolean
  experimentalMoonrakerSupport: boolean
  experimentalPrusaLinkSupport: boolean
  experimentalBambuSupport: boolean
  advancedFileListEnabled?: boolean
  printAssignmentEnabled?: boolean
  showPrintAssigneeOnGrid?: boolean
  checkPrinterStatusBeforePrint?: boolean
  gridStatusColorsEnabled?: boolean
  floorGridLockEnabled?: boolean
  gridStatusColors?: GridStatusColors
  advancedFileListColumns?: AdvancedFileListColumns
}
