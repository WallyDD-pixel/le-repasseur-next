import { NextResponse, type NextRequest } from "next/server";

import { isCheckoutPlanId } from "@/lib/stripePlans";
import { formatEurosFromCents } from "@/lib/userPromo";
import { verifyFirebaseUserIdToken } from "@/server/firebaseIdTokenVerify";
import { resolveCheckoutPricing } from "@/server/checkoutPricingResolve";

export async function GET(req: NextRequest) {
  const planId = req.nextUrl.searchParams.get("planId")?.trim() ?? "";
  const idToken = req.nextUrl.searchParams.get("idToken")?.trim() ?? "";

  if (!planId || !isCheckoutPlanId(planId)) {
    return NextResponse.json({ error: "Offre non reconnue." }, { status: 400 });
  }

  const user = idToken ? await verifyFirebaseUserIdToken(idToken) : null;

  const pricing = await resolveCheckoutPricing({
    planId,
    uid: user?.uid,
  });

  const baseCents = pricing.baseEuroCents;
  const finalCents = pricing.finalEuroCents;

  return NextResponse.json({
    ok: true,
    planId,
    baseEuros:
      baseCents != null ? formatEurosFromCents(baseCents).replace("€", "") : null,
    finalEuros:
      finalCents != null ? formatEurosFromCents(finalCents).replace("€", "") : null,
    priceLine:
      finalCents != null ? formatEurosFromCents(finalCents) : null,
    basePriceLine:
      baseCents != null ? formatEurosFromCents(baseCents) : null,
    promoPercent: pricing.promoPercent,
    hasPromo: pricing.promoPercent > 0,
  });
}
