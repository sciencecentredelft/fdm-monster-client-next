export interface AdvancedFileListColumns {
  size: boolean
  startedAt: boolean
}

export interface ServerSettingsDto {
  sentryDiagnosticsEnabled: boolean
  loginRequired: boolean
  registration: boolean
  experimentalMoonrakerSupport: boolean
  experimentalPrusaLinkSupport: boolean
  experimentalBambuSupport: boolean
  advancedFileListEnabled?: boolean
  advancedFileListColumns?: AdvancedFileListColumns
}
