import type { Firestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import type Stripe from "stripe";

import { TRANSACTIONS_COLLECTION } from "@/lib/activiteAdmin";
import {
  findPlanOrProductData,
  resolvePlanCredits,
} from "@/lib/planCreditsResolve";
import { resolveStripeSubscriptionContext } from "@/lib/stripeSubscriptionResolve";
import { isSubscriptionRecapPlan } from "@/lib/stripePlans";

export type SyncStripeSubscribersOptions = {
  /** Si false, aucune écriture Firestore (aperçu uniquement). */
  dryRun: boolean;
  /** Si true, fixe `reservations` et `collectes` (kg) aux quotas du plan. */
  setQuotas: boolean;
  /** Statuts Stripe à parcourir (défaut : `active` uniquement). */
  statuses?: Stripe.SubscriptionListParams["status"][];
};

export type SyncStripeSubscriberRow = {
  subscriptionId: string;
  status: string;
  email: string;
  planId: string;
  uid: string | null;
  outcome:
    | "updated"
    | "unchanged"
    | "skipped"
    | "no_user"
    | "no_plan"
    | "ambiguous_email"
    | "error";
  message?: string;
  changes?: Record<string, unknown>;
  before?: { role?: string; reservations?: unknown; collectes?: unknown };
};

export type SyncStripeSubscribersResult = {
  dryRun: boolean;
  setQuotas: boolean;
  scanned: number;
  rows: SyncStripeSubscriberRow[];
  summary: {
    updated: number;
    unchanged: number;
    skipped: number;
    no_user: number;
    no_plan: number;
    ambiguous_email: number;
    error: number;
  };
};

async function uidFromEmail(
  db: Firestore,
  email: string
): Promise<string | null> {
  const t = email.trim();
  if (!t) return null;
  const q = await db.collection("users").where("email", "==", t).limit(2).get();
  if (q.empty) return null;
  if (q.size > 1) return "__ambiguous__";
  return q.docs[0]!.id;
}

async function resolveUid(
  db: Firestore,
  firebaseUid: string,
  email: string
): Promise<{ uid: string | null; ambiguous: boolean }> {
  const uidMeta = firebaseUid.trim();
  if (uidMeta) {
    const snap = await db.collection("users").doc(uidMeta).get();
    if (snap.exists) return { uid: uidMeta, ambiguous: false };
  }
  const fromEmail = await uidFromEmail(db, email);
  if (fromEmail === "__ambiguous__") {
    return { uid: null, ambiguous: true };
  }
  return { uid: fromEmail, ambiguous: false };
}

function subscriptionAmountEuros(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0];
  const cents = item?.price?.unit_amount ?? item?.plan?.amount;
  if (typeof cents !== "number") return null;
  return Math.round((cents / 100) * 100) / 100;
}

async function listActiveSubscriptions(
  stripe: Stripe,
  statuses: Stripe.SubscriptionListParams["status"][]
): Promise<Stripe.Subscription[]> {
  const all: Stripe.Subscription[] = [];
  for (const status of statuses) {
    let startingAfter: string | undefined;
    for (;;) {
      const page = await stripe.subscriptions.list({
        status,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      all.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1]!.id;
    }
  }
  return all;
}

async function ensureSubscriptionTransaction(
  db: Firestore,
  uid: string,
  sub: Stripe.Subscription,
  planId: string,
  dryRun: boolean
): Promise<void> {
  const subId = sub.id;
  const existing = await db
    .collection(TRANSACTIONS_COLLECTION)
    .where("userId", "==", uid)
    .where("stripeSubscriptionId", "==", subId)
    .limit(1)
    .get();
  if (!existing.empty) return;

  const txId = `sync_${subId}`;
  const payload: Record<string, unknown> = {
    userId: uid,
    type: "abonnement",
    titre: planId ? `Formule ${planId}` : "Abonnement (sync)",
    role: planId,
    stripeSubscriptionId: subId,
    source: "sync-stripe-subscribers",
    transactionDate: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const amount = subscriptionAmountEuros(sub);
  if (amount != null) payload.montant = amount;

  if (dryRun) return;
  await db.collection(TRANSACTIONS_COLLECTION).doc(txId).set(payload, { merge: true });
}

/**
 * Aligne Firestore (`users` + lien `transactions`) sur les abonnements Stripe actifs.
 */
export async function syncStripeSubscribers(
  stripe: Stripe,
  db: Firestore,
  options: SyncStripeSubscribersOptions
): Promise<SyncStripeSubscribersResult> {
  const statuses = options.statuses?.length
    ? options.statuses
    : (["active"] as Stripe.SubscriptionListParams["status"][]);

  const subs = await listActiveSubscriptions(stripe, statuses);
  const rows: SyncStripeSubscriberRow[] = [];

  for (const sub of subs) {
    const base: Omit<SyncStripeSubscriberRow, "outcome"> = {
      subscriptionId: sub.id,
      status: sub.status,
      email: "",
      planId: "",
      uid: null,
    };

    try {
      const ctx = await resolveStripeSubscriptionContext(stripe, sub);
      base.email = ctx.customerEmail;
      base.planId = ctx.planId;

      if (!ctx.planId) {
        rows.push({
          ...base,
          outcome: "no_plan",
          message: "Plan introuvable (métadonnées / prix / montant).",
        });
        continue;
      }

      if (!isSubscriptionRecapPlan(ctx.planId)) {
        rows.push({
          ...base,
          outcome: "skipped",
          message: `« ${ctx.planId} » n’est pas une formule récurrente.`,
        });
        continue;
      }

      const { uid, ambiguous } = await resolveUid(
        db,
        ctx.firebaseUid,
        ctx.customerEmail
      );
      if (ambiguous) {
        rows.push({
          ...base,
          outcome: "ambiguous_email",
          message: `Plusieurs comptes pour l’email ${ctx.customerEmail}.`,
        });
        continue;
      }
      if (!uid) {
        rows.push({
          ...base,
          outcome: "no_user",
          message: ctx.customerEmail
            ? `Aucun utilisateur pour ${ctx.customerEmail}.`
            : "Email client introuvable.",
        });
        continue;
      }
      base.uid = uid;

      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        rows.push({
          ...base,
          outcome: "no_user",
          message: `Document users/${uid} absent.`,
        });
        continue;
      }

      const userData = userSnap.data() as Record<string, unknown>;
      const before = {
        role: typeof userData.role === "string" ? userData.role : undefined,
        reservations: userData.reservations,
        collectes: userData.collectes,
      };

      const amountEuros = subscriptionAmountEuros(sub);
      const planData = await findPlanOrProductData(db, ctx.planId, amountEuros);
      const { addReservations, addKg } = resolvePlanCredits(ctx.planId, planData);

      const updates: Record<string, unknown> = {
        role: ctx.planId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (options.setQuotas) {
        if (addReservations != null) updates.reservations = addReservations;
        if (addKg != null) updates.collectes = addKg;
      }

      const changes: Record<string, unknown> = { role: ctx.planId };
      if (options.setQuotas) {
        if (addReservations != null) changes.reservations = addReservations;
        if (addKg != null) changes.collectes = addKg;
      }

      const roleOk = before.role === ctx.planId;
      const resOk =
        !options.setQuotas ||
        addReservations == null ||
        before.reservations === addReservations;
      const kgOk =
        !options.setQuotas || addKg == null || before.collectes === addKg;

      if (roleOk && resOk && kgOk) {
        rows.push({
          ...base,
          outcome: "unchanged",
          before,
          changes,
        });
        if (!options.dryRun) {
          await ensureSubscriptionTransaction(db, uid, sub, ctx.planId, false);
        }
        continue;
      }

      if (!options.dryRun) {
        await userRef.set(updates, { merge: true });
        await ensureSubscriptionTransaction(db, uid, sub, ctx.planId, false);
      }

      rows.push({
        ...base,
        outcome: "updated",
        before,
        changes,
        message: options.dryRun ? "Serait mis à jour (--apply pour écrire)." : undefined,
      });
    } catch (e) {
      rows.push({
        ...base,
        outcome: "error",
        message: e instanceof Error ? e.message : "Erreur inconnue.",
      });
    }
  }

  const summary = {
    updated: 0,
    unchanged: 0,
    skipped: 0,
    no_user: 0,
    no_plan: 0,
    ambiguous_email: 0,
    error: 0,
  };
  for (const r of rows) {
    if (r.outcome in summary) {
      summary[r.outcome as keyof typeof summary] += 1;
    }
  }

  return {
    dryRun: options.dryRun,
    setQuotas: options.setQuotas,
    scanned: subs.length,
    rows,
    summary,
  };
}
