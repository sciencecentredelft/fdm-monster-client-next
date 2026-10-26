import { ServerApi } from '@/backend/server.api'
import { BaseService } from '@/backend/base.service'
import type { AdvancedFileListColumns } from '@/models/settings/server-settings.dto'
import {
  FrontendSettings,
  SettingsDto,
  TimeoutSettings,
  SettingsSensitiveDto
} from '@/models/settings/settings.model'

import type { GridStatusColors } from '@/shared/grid-status-colors'

export class SettingsService extends BaseService {
  static async updateFloorGridLock(enabled: boolean) {
    return await this.put<SettingsDto>(`${ServerApi.settingsRoute}/floor-grid-lock`, { enabled })
  }

  static async updateGridStatusColors(enabled: boolean, colors: GridStatusColors) {
    return await this.put<SettingsDto>(
      `${ServerApi.settingsRoute}/grid-status-colors`, { enabled, colors }
    )
  }

  static async updatePrePrintStatusCheck(enabled: boolean) {
    return await this.put<SettingsDto>(
      `${ServerApi.settingsRoute}/pre-print-status-check`, { enabled }
    )
  }

  static async updatePrintAssigneeGrid(enabled: boolean) {
    return await this.put<SettingsDto>(
      `${ServerApi.settingsRoute}/print-assignee-grid`, { enabled }
    )
  }

  static async updatePrintAssignment(enabled: boolean) {
    return await this.put<SettingsDto>(
      `${ServerApi.settingsRoute}/print-assignment`, { enabled }
    )
  }

  static async updateAdvancedFileList(enabled: boolean, columns?: AdvancedFileListColumns) {
    return await this.put<SettingsDto>(
      `${ServerApi.settingsRoute}/advanced-file-list`,
      { enabled, columns }
    )
  }

  static async getSettings() {
    const path = ServerApi.settingsRoute
    return await this.get<SettingsDto>(path)
  }

  static async getSettingsSensitive() {
    const path = ServerApi.settingsSensitiveRoute
    return await this.get<SettingsSensitiveDto>(path)
  }

  static async updateLoginRequiredSettings(loginRequired: boolean) {
    const path = `${ ServerApi.updateLoginRequiredRoute }`

    return await this.put<SettingsDto>(path, { loginRequired })
  }

  static async updateRegistrationEnabledSettings(registrationEnabled: boolean) {
    const path = `${ ServerApi.updateRegistrationEnabledRoute }`

    return await this.put<SettingsDto>(path, { registrationEnabled })
  }

  static async updateCredentialSettings(
    jwtExpiresIn: number,
    refreshTokenAttempts: number,
    refreshTokenExpiry: number
  ) {
    const path = `${ ServerApi.updateCredentialSettings }`

    return await this.put(path, {
      jwtExpiresIn,
      refreshTokenAttempts,
      refreshTokenExpiry
    })
  }

  static async updateFrontendSettings(frontendSettings: FrontendSettings) {
    const path = `${ ServerApi.updateFrontendSettingsRoute }`

    return await this.put<SettingsDto>(path, frontendSettings)
  }

  static async setSentryDiagnosticsSettings(enabled: boolean) {
    const path = `${ ServerApi.serverSentryDiagnosticsSettingRoute }`
    return await this.patch(path, { enabled })
  }

  static async updateTimeoutSettings(subSettings: TimeoutSettings) {
    const path = `${ ServerApi.updateTimeoutSettingRoute }`

    return await this.put<SettingsDto>(path, subSettings)
  }

  static async updateExperimentalMoonrakerSupport(enabled: boolean) {
    const path = ServerApi.updateExperimentalMoonrakerSupportRoute
    return await this.put<SettingsDto>(path, { enabled })
  }

  static async updateExperimentalPrusaLinkSupport(enabled: boolean) {
    const path = ServerApi.updateExperimentalPrusaLinkSupportRoute;
    return await this.put<SettingsDto>(path, { enabled })
  }

  static async updateExperimentalBambuSupport(enabled: boolean) {
    const path = ServerApi.updateExperimentalBambuSupportRoute
    return await this.put<SettingsDto>(path, { enabled })
  }

  static async updateExperimentalThumbnailSupport(enabled: boolean) {
    const path = ServerApi.updateExperimentalThumbnailSupportRoute;
    return await this.put<SettingsDto>(path, { enabled })
  }
 static async getSlicerApiKey() {
    const path = ServerApi.slicerApiKeyRoute
    return await this.get<{ slicerApiKey: string | null }>(path)
  }

  static async regenerateSlicerApiKey() {
    const path = ServerApi.regenerateSlicerApiKeyRoute
    return await this.post<{ slicerApiKey: string }>(path, {})
  }

  static async deleteSlicerApiKey() {
    const path = ServerApi.slicerApiKeyRoute
    return await this.delete<{ slicerApiKey: null }>(path)
  }
}
