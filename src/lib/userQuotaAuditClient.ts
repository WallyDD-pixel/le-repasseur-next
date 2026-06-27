import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import {
  USER_QUOTA_AUDIT_COLLECTION,
  type UserQuotaAuditEntry,
} from "@/lib/userQuotaAudit";
import { getFirebaseFirestore } from "@/lib/firebase";

/** Écrit une entrée journal depuis le client (admin connecté). */
export async function writeUserQuotaAuditClient(
  entry: UserQuotaAuditEntry
): Promise<string> {
  const ref = await addDoc(
    collection(getFirebaseFirestore(), USER_QUOTA_AUDIT_COLLECTION),
    {
      ...entry,
      createdAt: serverTimestamp(),
    }
  );
  return ref.id;
}
