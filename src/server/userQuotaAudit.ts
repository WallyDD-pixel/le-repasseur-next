import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

import {
  USER_QUOTA_AUDIT_COLLECTION,
  type UserQuotaAuditEntry,
} from "@/lib/userQuotaAudit";

/** Écrit une entrée dans le journal quotas (serveur / Admin SDK). */
export async function writeUserQuotaAudit(
  db: Firestore,
  entry: UserQuotaAuditEntry
): Promise<string> {
  const ref = db.collection(USER_QUOTA_AUDIT_COLLECTION).doc();
  await ref.set({
    ...entry,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/** Variante pour inclusion dans un batch Firestore existant. */
export function userQuotaAuditBatchSet(
  db: Firestore,
  batch: WriteBatch,
  entry: UserQuotaAuditEntry
): string {
  const ref = db.collection(USER_QUOTA_AUDIT_COLLECTION).doc();
  batch.set(ref, {
    ...entry,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}
