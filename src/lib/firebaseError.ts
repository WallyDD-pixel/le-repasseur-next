/** Message lisible pour les erreurs Firebase / réseau dans le navigateur. */
export function firebaseMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    const code =
      "code" in err && typeof (err as { code: unknown }).code === "string"
        ? `${(err as { code: string }).code} · `
        : "";
    return `${code}${(err as { message: string }).message}`;
  }
  return String(err);
}
