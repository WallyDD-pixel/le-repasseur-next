"use client";

import Link from "next/link";
import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { CONTACT_MESSAGE_WRITE_COLLECTION } from "@/lib/contactMessagesAdmin";
import { getFirebaseFirestore } from "@/lib/firebase";
import { firebaseMessage } from "@/lib/firebaseError";
import { Input, Label, PrimaryButton } from "@/components/ui/FormField";

export function ContactForm() {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setError(null);

    const mail = email.trim();
    const texte = message.trim();
    if (!mail) {
      setError("Indiquez votre adresse e-mail.");
      return;
    }
    if (!texte) {
      setError("Écrivez votre message.");
      return;
    }

    setLoading(true);
    try {
      const db = getFirebaseFirestore();
      await addDoc(collection(db, CONTACT_MESSAGE_WRITE_COLLECTION), {
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: mail,
        telephone: telephone.trim(),
        message: texte,
        createdAt: serverTimestamp(),
      });
      setOk("Votre message a bien été envoyé. Nous vous répondrons dès que possible.");
      setNom("");
      setPrenom("");
      setEmail("");
      setTelephone("");
      setMessage("");
    } catch (err) {
      setError(`Envoi impossible — ${firebaseMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-nom">Nom</Label>
          <Input
            id="contact-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoComplete="family-name"
            className="mt-1"
            disabled={loading}
          />
        </div>
        <div>
          <Label htmlFor="contact-prenom">Prénom</Label>
          <Input
            id="contact-prenom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            autoComplete="given-name"
            className="mt-1"
            disabled={loading}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="contact-email">Email *</Label>
        <Input
          id="contact-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="mt-1"
          disabled={loading}
        />
      </div>
      <div>
        <Label htmlFor="contact-msg">Message *</Label>
        <textarea
          id="contact-msg"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#10294B] shadow-sm outline-none ring-[#CE2029]/15 focus:border-[#10294B]/35 focus:ring-4"
          disabled={loading}
        />
      </div>
      <div>
        <Label htmlFor="contact-tel">Téléphone</Label>
        <Input
          id="contact-tel"
          type="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          autoComplete="tel"
          className="mt-1"
          disabled={loading}
        />
      </div>

      {ok ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {ok}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton
          type="submit"
          loading={loading}
          className="w-auto"
        >
          Envoyer
        </PrimaryButton>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          onClick={(e) => {
            // Empêche de quitter pendant l’envoi en cours.
            if (loading) e.preventDefault();
          }}
        >
          Retour
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        * : champs obligatoires. Les envois sont horodatés dans Firestore (
        <code className="rounded bg-slate-100 px-1">{CONTACT_MESSAGE_WRITE_COLLECTION}</code>
        ).
      </p>
    </form>
  );
}
