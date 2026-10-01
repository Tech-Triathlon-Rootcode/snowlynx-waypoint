import type { DeliveryRecordInput } from "./types";

export function validateDeliveryRecord(input: DeliveryRecordInput): void {
  if (!Number.isInteger(input.quantity) || input.quantity < 0 || input.quantity > input.loadedQuantity) {
    throw new Error("Received quantity must be a whole number within the loaded quantity.");
  }
  if (input.outcome === "DELIVERED" && input.quantity !== input.loadedQuantity) {
    throw new Error("Use partial delivery when fewer units were received.");
  }
  if (input.outcome === "PARTIAL" && (input.quantity === 0 || input.quantity === input.loadedQuantity)) {
    throw new Error("A partial delivery must contain some, but not all, loaded units.");
  }
  if (input.outcome === "UNABLE" && input.quantity !== 0) {
    throw new Error("Unable to deliver must have zero received units.");
  }
  if (input.receiverOrReason.trim().length < 2 || !input.acknowledged) {
    throw new Error("Add a receiver name or failure reason and acknowledge the record.");
  }
}

export function validateReceipt(delivered: number, received: number, issue: string): void {
  if (!Number.isInteger(received) || received < 0) throw new Error("Enter a valid received quantity.");
  if (received !== delivered && issue.trim().length < 4) {
    throw new Error("Explain the difference from the driver record.");
  }
}
