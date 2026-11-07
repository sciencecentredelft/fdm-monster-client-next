export type UserDirectoryAuthMode = 'none' | 'credentials' | 'oauth2'
export type UserDirectoryCredentialPlacement = 'header' | 'query' | 'json' | 'form'
export type UserDirectoryTokenPlacement = 'basic' | 'json' | 'form'

export interface UserDirectoryConfig {
  enabled: boolean
  allowManualEntry: boolean
  endpoint: string
  method: 'GET' | 'POST'
  authMode: UserDirectoryAuthMode
  credentialPlacement: UserDirectoryCredentialPlacement
  clientId: string
  clientIdField: string
  clientSecretField: string
  tokenEndpoint: string
  tokenCredentialPlacement: UserDirectoryTokenPlacement
  scope: string
  accessTokenPath: string
  tokenTypePath: string
  usersPath: string
  namePath: string
  emailPath: string
  paginationEnabled: boolean
  pageNumberParameter: string
  pageSizeParameter: string
  pageSize: number
  countPath: string
  pageNumberPath: string
  pageSizePath: string
  combineNames: boolean
  firstNamePath: string
  lastNamePath: string
}

export interface UserDirectoryPerson {
  name: string
  email: string
}

export interface PrintAssignee {
  name: string
  email: string | null
}

export interface UserDirectorySettings {
  config: UserDirectoryConfig
  hasClientSecret: boolean
}

export const defaultUserDirectoryConfig: UserDirectoryConfig = {
  enabled: false,
  allowManualEntry: true,
  endpoint: '',
  method: 'GET',
  authMode: 'none',
  credentialPlacement: 'form',
  clientId: '',
  clientIdField: 'client_id',
  clientSecretField: 'client_secret',
  tokenEndpoint: '',
  tokenCredentialPlacement: 'form',
  scope: '',
  accessTokenPath: 'access_token',
  tokenTypePath: 'token_type',
  usersPath: 'users',
  namePath: 'name',
  emailPath: 'email',
  paginationEnabled: false,
  pageNumberParameter: 'page_number',
  pageSizeParameter: 'page_size',
  pageSize: 50,
  countPath: 'count',
  pageNumberPath: 'page_number',
  pageSizePath: 'page_size',
  combineNames: false,
  firstNamePath: 'first_name',
  lastNamePath: 'last_name'
}
