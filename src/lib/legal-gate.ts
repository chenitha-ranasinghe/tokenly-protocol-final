/**
 * Legal approval gate — tokenization / public bidding only after statutory approval.
 */
import crypto from 'crypto';
import type { LegalApprovalStatus } from './types';

export function canTokenizeProject(legalStatus: LegalApprovalStatus, approvalDocHash?: string | null): {
  allowed: boolean;
  reason?: string;
} {
  if (legalStatus !== 'approved') {
    return {
      allowed: false,
      reason: 'UDA or local authority approval must be recorded before tokenization.',
    };
  }
  if (!approvalDocHash || approvalDocHash.length < 16) {
    return {
      allowed: false,
      reason: 'Approval document hash is required for audit trail.',
    };
  }
  return { allowed: true };
}

export function canOpenPublicBidding(
  legalStatus: LegalApprovalStatus,
  status: string
): { allowed: boolean; reason?: string } {
  if (legalStatus !== 'approved') {
    return { allowed: false, reason: 'Project must be legally approved before contractors can bid.' };
  }
  if (!['approved', 'bidding'].includes(status)) {
    return { allowed: false, reason: `Project status must be approved or bidding (current: ${status}).` };
  }
  return { allowed: true };
}

export function hashApprovalDocument(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
