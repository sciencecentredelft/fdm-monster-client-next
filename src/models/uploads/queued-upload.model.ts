import { PrinterDto } from '@/models/printers/printer.model'

export interface QueuedUpload {
  printer: PrinterDto
  file: File
  startPrint: boolean
  assignedTo?: string
  assignedEmail?: string | null
}

export interface FailedQueuedUpload extends QueuedUpload {
  error: any
}
