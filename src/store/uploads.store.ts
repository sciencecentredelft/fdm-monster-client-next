import { defineStore } from 'pinia'
import {
  FailedQueuedUpload,
  QueuedUpload
} from '@/models/uploads/queued-upload.model'
import { PrinterRemoteFileService } from '@/backend'
import { useSnackbar } from '@/shared/snackbar.composable'
import { confirmPrintAssignment } from '@/shared/print-assignment.composable'

export interface UploadsState {
  queuedUploads: QueuedUpload[]
  failedUploads: FailedQueuedUpload[]
  uploadingNow: boolean
}

export const useUploadsStore = defineStore('Uploads', {
  state: (): UploadsState => ({
    queuedUploads: [],
    failedUploads: [],
    uploadingNow: false
  }),
  getters: {
    hasPendingUploads(state) {
      return state.queuedUploads?.length > 0
    },
    isUploadingNow(state) {
      return state.uploadingNow
    },
    nextUpload(state) {
      return state.queuedUploads[0]
    }
  },
  actions: {
    async queueUploads(uploads: QueuedUpload[]) {
      const prints = uploads.filter(upload => upload.startPrint)
      const assignedTo = prints.length ? await confirmPrintAssignment(prints.map(upload => ({
        printerId: upload.printer.id, printerName: upload.printer.name, fileName: upload.file.name
      }))) : undefined
      if (assignedTo === null) return false
      this.failedUploads = []
      this.queuedUploads.push(...uploads.map(upload => ({
        ...upload, assignedTo: upload.startPrint ? assignedTo : undefined
      })))
      return true
    },
    cancelUploads() {
      this.queuedUploads = []
      this.failedUploads = []
    },
    async handleNextUpload() {
      const snackbar = useSnackbar()
      // Dont upload when queue empty
      if (!this.queuedUploads?.length) return
      this.uploadingNow = true;
      const { file, printer, startPrint, assignedTo } = this.nextUpload;
      // We'd rather fail fast and avoid the same upload failing many times
      this.queuedUploads.splice(0, 1);

      try {
        await PrinterRemoteFileService.uploadFile(printer, file, startPrint, assignedTo);
      } catch (e: any) {
        if (e.isAxiosError) {
          const failedUpload: FailedQueuedUpload = {
            file,
            printer,
            error: e,
            startPrint: false,
          };
          this.failedUploads.push(failedUpload)
          snackbar.openErrorMessage({
            title: 'Upload failure',
            subtitle: `File ${file.name}Upload failed for  to printer ${printer.name}`
          })
        } else {
          snackbar.openErrorMessage({
            title: 'Upload failure',
            subtitle: 'Unknown upload error occurred'
          })
        }
      }
      this.uploadingNow = false
    }
  }
})
