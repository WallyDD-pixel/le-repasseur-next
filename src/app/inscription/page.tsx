"use client";

import { useState } from "react";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { PageShell } from "@/components/shell/PageShell";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";

export default function InscriptionPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const db = getFirebaseFirestore();
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      await setDoc(doc(db, "users", cred.user.uid), {
        email: email.trim(),
        prenom: prenom.trim(),
        nom: nom.trim(),
        role: "aucun",
        createdAt: serverTimestamp(),
        dateInscription: serverTimestamp(),
      });
      window.location.href = "/espace-client";
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code === "auth/email-already-in-use") {
        setError("Cet e-mail est déjà utilisé.");
      } else if (code === "auth/weak-password") {
        setError("Mot de passe trop faible (min. 6 caractères).");
      } else {
        setError("Inscription impossible. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      title="Créer un compte"
      subtitle="Rejoignez Le Repasseur en quelques secondes."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="prenom">Prénom</Label>
            <Input
              id="prenom"
              required
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="nom">Nom</Label>
            <Input
              id="nom"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <PrimaryButton type="submit" loading={loading}>
          S&apos;inscrire
        </PrimaryButton>
      </form>
      <p className="mt-8 border-t border-slate-200/80 pt-6 text-center text-sm text-slate-600">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold text-[#10294B] hover:underline">
          Connexion
        </Link>
      </p>
    </PageShell>
  );
}
