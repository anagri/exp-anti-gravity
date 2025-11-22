/**
 * Centralized test ID constants for E2E testing
 *
 * Convention: <element-type>-<component>-<action/description>
 *
 * Element types:
 * - btn: Button
 * - input: Input field
 * - select: Select dropdown
 * - div: Container/div
 * - modal: Modal dialog
 * - table: Table
 *
 * Examples:
 * - btn-submit-form
 * - input-search-query
 * - modal-delete-kb
 * - div-error-message
 */

// Welcome Page
export const WELCOME_PAGE = {
  INPUT_API_KEY: 'input-welcome-apikey',
  BTN_SUBMIT: 'btn-welcome-submit',
  BTN_SETTINGS: 'btn-welcome-settings',
} as const;

// Chat Page
export const CHAT_PAGE = {
  INPUT_MESSAGE: 'input-chat-message',
  BTN_SEND: 'btn-chat-send',
  BTN_ATTACH: 'btn-chat-attach',
  DIV_MESSAGE_USER: 'div-chat-user-msg',
  DIV_MESSAGE_ASSISTANT: 'div-chat-assistant-msg',
  BTN_CLEAR_CHAT: 'btn-chat-clear',
} as const;

// Documents Page
export const DOCUMENTS_PAGE = {
  BTN_CREATE_KB: 'btn-create-kb',
  DIV_KB_LIST: 'div-kb-list',
  DIV_INIT_ERROR: 'div-init-error',
  BTN_RETRY_INIT: 'btn-retry-init',
} as const;

// Knowledge Base Card
export const KB_CARD = {
  card: (kbId: string) => `kb-card-${kbId}`,
  btnEdit: (kbId: string) => `btn-edit-kb-${kbId}`,
  btnDelete: (kbId: string) => `btn-delete-kb-${kbId}`,
} as const;

// Modals
export const MODALS = {
  CREATE_KB: 'modal-create-kb',
  DELETE_KB: 'modal-delete-kb',
  DELETE_DOC: 'modal-delete-doc',
  SETTINGS: 'div-settings-modal',
} as const;

// Settings
export const SETTINGS = {
  BTN_CLOSE: 'btn-close-settings',
  BTN_RELOAD: 'btn-reload-now',
  TABLE_FLAGS: 'table-feature-flags',
  DIV_RELOAD_WARNING: 'reload-warning',
} as const;

// Search Page
export const SEARCH_PAGE = {
  SELECT_KB: 'select-kb-search',
  INPUT_QUERY: 'input-search-query',
  BTN_SEARCH: 'button-search',
  BTN_CLEAR: 'button-clear-search',
  DIV_RESULTS: 'div-search-results',
  DIV_EMPTY: 'div-search-empty',
} as const;

// File Upload
export const FILE_UPLOAD = {
  INPUT: 'file-upload-input',
  ZONE: 'upload-zone',
} as const;

// Document Card
export const DOC_CARD = {
  card: (docId: string) => `doc-card-${docId}`,
  btnDelete: (docId: string) => `btn-delete-doc-${docId}`,
  btnRetry: (docId: string) => `btn-retry-doc-${docId}`,
  btnDownload: (docId: string) => `btn-download-doc-${docId}`,
} as const;
