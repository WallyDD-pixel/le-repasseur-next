import Image from "next/image";
import Link from "next/link";
import { siteAsset } from "@/lib/assetBase";
import type { HomeFirestoreImages } from "@/lib/homeFirestoreImages";

const FB_DESKTOP =
  "https://firebasestorage.googleapis.com/v0/b/repasseurflutter-7fc37.appspot.com/o/TousLesAbo%20(2).jpg?alt=media&token=88bcab71-4349-41f4-833e-92dff1f4d904";
const FB_MOBILE1 =
  "https://firebasestorage.googleapis.com/v0/b/repasseurflutter-7fc37.appspot.com/o/AMORE.png?alt=media&token=7197b4f3-87e1-4a63-96a9-1775e48044d2";
const FB_MOBILE2 =
  "https://firebasestorage.googleapis.com/v0/b/repasseurflutter-7fc37.appspot.com/o/AMORE%20(2).png?alt=media&token=3ce26a5e-66f3-4778-8da0-787bc65bfe2a";

/** Contour ~3px bleu marine + liseré rubis (couleurs du site) */
const HOME_IMG_FRAME =
  "box-border overflow-hidden rounded-xl border-[3px] border-[#10294B] shadow-[0_0_0_1px_rgba(206,32,41,0.95)]";

function FireImg({
  src,
  alt,
  className,
  style,
}: {
  src?: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!src)
    return (
      <div
        className={`min-h-[200px] animate-pulse rounded-xl bg-gray-200 ${HOME_IMG_FRAME} ${className ?? ""}`}
      />
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`max-h-[470px] max-w-full ${HOME_IMG_FRAME} ${className ?? ""}`}
      style={style}
    />
  );
}

function CtaBar() {
  return (
    <div
      className="mt-5 flex flex-col items-center justify-center gap-3 px-4 py-3 text-center"
      style={{ backgroundColor: "#10294B" }}
    >
      <Link
        href="/connexion"
        className="rounded-[10px] px-5 py-2.5 font-medium text-white"
        style={{ backgroundColor: "#CE2029" }}
      >
        Choisir mon abonnement
      </Link>
      <a href="/#offres" className="text-sm text-white underline">
        Comparez les abonnements
      </a>
    </div>
  );
}

export function LegacyHomeSections({ images }: { images: HomeFirestoreImages }) {
  return (
    <div className="bg-white text-gray-900">
      <div className="w-full overflow-x-hidden px-0 pt-2 sm:pt-4">
        <picture>
          <source
            media="(max-width: 768px)"
            srcSet={siteAsset("/assets/imgg/1erpaniere768.jpg")}
          />
          <source
            media="(min-width: 769px)"
            srcSet={siteAsset("/assets/imgg/1erpaniereV2.jpg")}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteAsset("/assets/imgg/1erpaniereV2.jpg")}
            alt="Le Repasseur"
            className="mx-auto block h-auto w-full max-w-[100vw] object-cover"
          />
        </picture>
      </div>

      <div className="container mx-auto max-w-[1200px] px-4 py-6">
        <div className="flex flex-col-reverse items-center gap-8 py-6 lg:flex-row-reverse lg:items-center">
          <div className="w-full lg:w-1/2">
            <h1 className="mb-3 text-3xl font-bold leading-tight text-gray-900 md:text-4xl">
              Bienvenue chez Le Repasseur.fr
            </h1>
            <h2 className="mb-3 text-2xl font-bold text-gray-900 md:text-3xl">
              Vite fait, bien fait, sans vous déplacer !
            </h2>
            <p className="text-lg leading-relaxed text-gray-700">
              Le Repasseur.fr est une entreprise locale, basée à Antibes.{" "}
              <br />
              Il a pour mission de simplifier votre quotidien grâce à notre
              service de repassage haute qualité avec collecte à domicile de
              votre linge à repasser et retour chez vous en 24h*
              <br />
              <br />
              Pratique, rapide et efficace ! Fini le temps passé à repasser votre
              linge, nous nous occupons de tout pour vous permettre de profiter
              pleinement de votre temps libre.
            </p>
          </div>
          <div className="w-full max-w-md lg:w-1/2">
            <div className={HOME_IMG_FRAME}>
              <Image
                src={siteAsset("/assets/imgg/Image Accueil.jpg")}
                alt="Accueil Le Repasseur"
                width={800}
                height={600}
                className="mx-auto h-auto w-full object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      </div>

      <section id="marche" className="scroll-mt-24 container mx-auto max-w-[1200px] px-4">
        <div className="flex flex-col gap-8 py-8 md:flex-row md:items-start">
          <div className="md:order-2 md:w-[58%]">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">
              <strong>Comment ça marche</strong>
            </h2>
            <ul className="list-none space-y-4 pl-0">
              <li>
                <h3 className="text-xl font-semibold" style={{ color: "#cc151b" }}>
                  Inscription facile :
                </h3>
                <p>
                  Choisissez parmi nos formules{" "}
                  <strong>d&apos;abonnements flexibles</strong> et{" "}
                  <strong>sans engagement</strong>, adaptées à vos besoins
                  spécifiques.
                </p>
              </li>
              <li>
                <h3 className="text-xl font-semibold" style={{ color: "#cc151b" }}>
                  Collecte à domicile :
                </h3>
                <p>
                  Réservez un{" "}
                  <strong>créneau horaire sur notre application</strong> pour que
                  notre équipe vienne{" "}
                  <strong>récuperer votre linge à votre domicile.</strong>
                </p>
              </li>
              <li>
                <h3 className="text-xl font-semibold" style={{ color: "#cc151b" }}>
                  Traitement professionel :
                </h3>
                <p>
                  Notre <strong>équipe qualifiée </strong>repasse votre linge
                  dans nos locaux en prenant le plus grand soin, pour un{" "}
                  <strong>repassage impeccable.</strong>
                </p>
              </li>
              <li>
                <h3 className="text-xl font-semibold" style={{ color: "#cc151b" }}>
                  Retour rapide :
                </h3>
                <p>
                  Profitez d&apos;un retour rapide de votre linge repassé{" "}
                  <strong>
                    24 heures après la collecte, à votre domicile.
                  </strong>
                </p>
              </li>
            </ul>
          </div>
          <div className="md:order-1 md:w-[42%]">
            <div className={HOME_IMG_FRAME}>
              <Image
                src={siteAsset("/assets/imgg/Header-flemme.jpg")}
                alt="Comment ça marche"
                width={600}
                height={500}
                className="h-auto w-full object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      </section>

      <section id="choisir" className="scroll-mt-24 container mx-auto max-w-[1200px] px-4 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="md:w-[58%]">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">
              <strong>Pourquoi choisir le repasseur.fr ?</strong>
            </h2>
            <ul className="list-none space-y-4 pl-0">
              <li>
                <h3 className="text-xl font-semibold" style={{ color: "#cc151b" }}>
                  Service sur mesure :
                </h3>
                <p className="text-xl">
                  Des abonnements flexibles adaptés à vos budgets.
                </p>
              </li>
              <li>
                <h3 className="text-xl font-semibold" style={{ color: "#cc151b" }}>
                  Qualité garantie :
                </h3>
                <p className="text-xl">
                  Un service professionnel et fiable pour résultats impeccables à
                  chaque fois
                </p>
              </li>
              <li>
                <h3 className="text-xl font-semibold" style={{ color: "#cc151b" }}>
                  Gain de temps :
                </h3>
                <p className="text-xl">
                  Libérez-vous des corvées ménagères pour vous concentrer sur ce
                  qui compte vraiment pour vous.
                </p>
              </li>
              <li>
                <h3 className="text-xl font-semibold" style={{ color: "#cc151b" }}>
                  facilité d&apos;utilisation :
                </h3>
                <p className="text-xl">
                  Notre application conviviale vous permet de gérer facilement vos
                  réservations et de suivre l&apos;avancement de votre commande
                </p>
              </li>
            </ul>
          </div>
          <div className="md:w-[42%]">
            <div className={HOME_IMG_FRAME}>
              <Image
                src={siteAsset("/assets/imgg/Header-ass.jpg")}
                alt="Le Repasseur"
                width={600}
                height={500}
                className="h-auto w-full object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      </section>

      <section id="telecharger" className="scroll-mt-24 w-full py-2">
        <div className="w-full py-8 text-center" style={{ backgroundColor: "#CE2029" }}>
          <h2 className="mb-6 px-4 text-2xl font-normal text-white md:text-3xl">
            Téléchargez l&apos;appli et programmez <br /> votre première collecte
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a
              href="https://play.google.com/store/apps/details?id=com.repasseur.repasseur&gl=FR"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block leading-none transition hover:opacity-90"
            >
              <Image
                src={siteAsset("/assets/imgg/pngegg.png")}
                alt="Google Play"
                width={150}
                height={50}
                className="h-auto w-[150px]"
                unoptimized
              />
            </a>
            <a
              href="https://apps.apple.com/us/app/le-repasseur/id6670428906"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block leading-none transition hover:opacity-90"
            >
              <Image
                src={siteAsset("/assets/imgg/pngegg (1).png")}
                alt="App Store"
                width={150}
                height={50}
                className="h-auto w-[150px]"
                unoptimized
              />
            </a>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-[1200px] px-4 py-4">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FB_DESKTOP}
            alt="Offres"
            className={`mx-auto hidden max-w-full md:block ${HOME_IMG_FRAME}`}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FB_MOBILE1}
            alt="Offres mobile"
            className={`mx-auto max-w-full md:hidden ${HOME_IMG_FRAME}`}
          />
          <div className="font-lobster py-2 text-2xl md:hidden" style={{ color: "#10294B" }}>
            <p>ou</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FB_MOBILE2}
            alt="Offres mobile 2"
            className={`mx-auto max-w-full md:hidden ${HOME_IMG_FRAME}`}
          />
        </div>
      </div>

      <section id="collecte" className="scroll-mt-24 w-full">
        <div className="container mx-auto max-w-[1200px] px-4 py-6">
          <h1 className="mb-6 text-3xl font-bold">Collecte sans abonnement </h1>
          <div className="mb-8 flex flex-col gap-6 md:flex-row">
            <div className="md:w-1/3">
              <FireImg src={images.pack5} alt="Pack 5 kg" />
            </div>
            <div className="md:w-2/3">
              <h2 className="font-lobster text-3xl" style={{ color: "#CE2029" }}>
                Pack 5 kg
              </h2>
              <h2 className="text-2xl" style={{ color: "#CE2029" }}>
                49€ pour 1 collecte 5 kg{" "}
              </h2>
              <p className="text-2xl font-bold">
                5 kg de linge correspond à environ 25 et 35 vêtements.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="md:w-1/3">
              <FireImg src={images.pack10} alt="Pack 10 kg" />
            </div>
            <div className="md:w-2/3">
              <h2 className="font-lobster text-3xl" style={{ color: "#CE2029" }}>
                Pack 10 kg
              </h2>
              <h2 className="text-2xl" style={{ color: "#CE2029" }}>
                69€ pour 1 collecte 10 kg{" "}
              </h2>
              <p className="text-2xl font-bold">
                10 kg de linge correspond à environ 50 vêtements.
              </p>
            </div>
          </div>
        </div>
        <CtaBar />
      </section>

      <div className="container mx-auto max-w-[1200px] px-4 py-10">
        <h2 className="mb-4 text-4xl font-bold" style={{ color: "#10294B" }}>
          Tarifs et Abonnements
        </h2>
        <h3 className="mb-4 text-2xl" style={{ color: "#CE2029" }}>
          Pourquoi un abonnement ?{" "}
        </h3>
        <div className="max-w-3xl space-y-4 text-gray-800">
          <p>
            Explorez nos differents abonnements mensuels et Choisissez celui qui
            correspond le mieux à vos besoins. <br /> Le Repasseur est déterminé
            à vous offrir le meilleur rapport qualité-prix pour vos besoins de
            repassage. C&apos;est pourquoi nous proposons des abonnements
            mensuels avantageux qui vous permettent de bénéficier de tarifs
            réduits sur chaque collecte de linge. Nous comprenons que le
            repassage est une tâche récurrente, et en optant pour un abonnement,
            vous économisez non seulement de l&apos;argent, mais aussi du temps
            et de l&apos;énergie. En mutualisant les charges entre nos clients
            abonnés, nous sommes en mesure de vous offrir des tarifs compétitifs
            que vous ne trouverez nulle part ailleurs.
          </p>
          <p>
            Nos abonnements offrent une flexibilité totale, vous permettant de
            sélectionner le nombre de collectes mensuelles qui vous convient le
            mieux.
          </p>
          <p>
            Avec un abonnement, vous avez la tranquillité d&apos;esprit de savoir
            que votre linge sera pris en charge régulièrement, tout en réalisant
            des économies substantielles sur chaque prestation. Optez pour un
            abonnement dès aujourd&apos;hui et découvrez comment Le Repasseur peut
            simplifier votre vie et alléger votre budget.
          </p>
          <p>
            Abonnement sans engagement, résiliable depuis votre compte à partir
            du 2ème mois.
          </p>
        </div>
        <h3 className="mb-4 mt-8 text-2xl" style={{ color: "#CE2029" }}>
          Comment choisir mon abonnement ?
        </h3>
        <div className="max-w-3xl space-y-4 text-gray-800">
          <p>
            Nous comprenons que le poids du linge peut varier considérablement
            d&apos;un client à l&apos;autre, c&apos;est pourquoi nous proposons une
            gamme de formules d&apos;abonnement pour répondre à vos besoins
            spécifiques. Les abonnements ont été conçus pour que vous puissiez
            faire repasser tout types de vêtements, comme des polos, des chemises,
            des pantalons et des t-shirts, etc, sans distinction.
          </p>
          <p>
            Pour tous nos forfaits, vous pouvez décider de récupérer votre linge
            plié ou sur cintre.
          </p>
        </div>

        <section id="abonnements" className="scroll-mt-24 mt-10 space-y-12">
          <h1 className="text-3xl font-bold" style={{ color: "#CE2029" }}>
            Les Abonnements
          </h1>

          <div className="flex flex-col gap-6 md:flex-row">
            <div className="md:w-1/3">
              <FireImg src={images.mino} alt="Mino" />
            </div>
            <div className="md:w-2/3">
              <h2 className="font-lobster text-3xl" style={{ color: "#CE2029" }}>
                Mino
              </h2>
              <h2 className="text-2xl" style={{ color: "#CE2029" }}>
                19€ pour 2,5 kg par mois - 1 collecte
              </h2>
              <p className="text-lg">
                &quot;Pour nos étudiants et ceux qui mènent une vie active, notre
                formule Mino est parfaite ! Avec seulement 19€ par mois, vous
                bénéficiez d&apos;un service de repassage jusqu&apos;à 2,5 kg de
                linge.&quot;
              </p>
              <p className="mt-2 text-2xl font-bold">
                2,5 kg de linge correspond à environ 15 et 20 vêtements.
              </p>
            </div>
          </div>
          <CtaBar />

          <div className="flex flex-col gap-6 md:flex-row">
            <div className="md:w-1/3">
              <FireImg src={images.solo} alt="Solo" />
            </div>
            <div className="md:w-2/3">
              <h2 className="font-lobster text-3xl" style={{ color: "#CE2029" }}>
                Solo
              </h2>
              <h2 className="text-2xl" style={{ color: "#CE2029" }}>
                39€ pour 5 kg par mois - 1 à 2 collectes
                <span className="block text-xl" style={{ color: "#10294B" }}>
                  Kit Repasseur OFFERT
                </span>
              </h2>
              <p className="text-lg">
                &quot;Pour nos clients célibataires ou seuls dans le foyer à avoir
                besoin de repassage, notre formule Solo est conçue pour vous !&quot;
              </p>
              <p className="mt-2 text-2xl font-bold">
                5 kg de linge correspond à environ 25 et 35 vêtements.
              </p>
            </div>
          </div>
          <CtaBar />

          <div className="flex flex-col gap-6 md:flex-row">
            <div className="md:w-1/3">
              <FireImg src={images.duo} alt="Duo" />
            </div>
            <div className="md:w-2/3">
              <h2 className="font-lobster text-3xl" style={{ color: "#CE2029" }}>
                Duo
              </h2>
              <h2 className="text-2xl" style={{ color: "#CE2029" }}>
                59€ pour 10 kg par mois - 1 ou 4 collectes
                <span className="block text-xl" style={{ color: "#10294B" }}>
                  Kit Repasseur OFFERT
                </span>
              </h2>
              <p className="text-lg">
                &quot;Pour les couples dynamiques, notre formule Duo est la solution
                idéale !&quot;
              </p>
              <p className="mt-2 text-2xl font-bold">
                10 kg de linge correspond à environ 50 vêtements.
              </p>
            </div>
          </div>
          <CtaBar />

          <div className="flex flex-col gap-6 md:flex-row">
            <div className="md:w-1/3">
              <FireImg src={images.marmo} alt="Marmo" />
            </div>
            <div className="md:w-2/3">
              <h2 className="font-lobster text-3xl" style={{ color: "#CE2029" }}>
                Marmo
              </h2>
              <h2 className="text-2xl" style={{ color: "#CE2029" }}>
                99€ pour 20 kg par mois - 1 à 4 collectes
                <span className="block text-xl" style={{ color: "#10294B" }}>
                  Kit Repasseur OFFERT
                </span>
              </h2>
              <p className="text-lg">
                &quot;Pour les familles nombreuses ou un volume de linge important !&quot;
              </p>
              <p className="mt-2 text-2xl font-bold">
                20 kg de linge correspond à environ 100 vêtements :
              </p>
            </div>
          </div>
          <CtaBar />

          <div className="flex flex-col gap-6 md:flex-row">
            <div className="md:w-1/3">
              <FireImg src={images.superHero} alt="Super Héros" />
            </div>
            <div className="md:w-2/3">
              <h2 className="font-lobster text-3xl" style={{ color: "#CE2029" }}>
                Super Héros
              </h2>
              <h2 className="text-2xl" style={{ color: "#CE2029" }}>
                199€ pour 40 kg par mois - 1 à 4 collectes
                <span className="block text-xl" style={{ color: "#10294B" }}>
                  Kit Repasseur OFFERT
                </span>
              </h2>
              <p className="text-lg">
                &quot;Pour les familles nombreuses ou ceux qui ont un volume de linge
                important, notre formule Super Héros est faite pour vous ! Pour
                199€ par mois, vous bénéficiez d&apos;un service complet pour 40 kg
                de linge par mois.&quot;
              </p>
              <p className="mt-2 text-2xl font-bold">
                40 kg de linge correspond à environ 200 vêtements :
              </p>
            </div>
          </div>
          <CtaBar />
        </section>

        <section id="offres" className="mt-16 scroll-mt-24">
          <h1 className="mb-6 text-center text-3xl font-bold">
            Comparer les abonnements
          </h1>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-separate border-spacing-4 text-center text-sm md:text-base">
              <thead>
                <tr>
                  <th className="font-lobster p-2 text-2xl text-[#CE2029]" />
                  <th className="font-lobster p-2 text-2xl text-[#CE2029]">Mino</th>
                  <th className="font-lobster p-2 text-2xl text-[#CE2029]">Solo</th>
                  <th className="font-lobster p-2 text-2xl text-[#CE2029]">Duo</th>
                  <th className="font-lobster p-2 text-2xl text-[#CE2029]">Marmo</th>
                  <th className="whitespace-nowrap border-r-2 border-[#CE2029] p-2 font-lobster text-2xl text-[#CE2029]">
                    Super Héros
                  </th>
                  <th className="whitespace-nowrap p-2 font-lobster text-2xl text-[#10294B]">
                    Pack 5 kg
                    <br />
                    <span className="text-[10px] text-[#CE2029]">
                      Sans abonnement
                    </span>
                  </th>
                  <th className="whitespace-nowrap p-2 font-lobster text-2xl text-[#10294B]">
                    Pack 10 kg
                    <br />
                    <span className="text-[10px] text-[#CE2029]">
                      Sans abonnement
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-50">
                  <td className="p-2 font-bold">Prix</td>
                  <td className="p-2">19€ / mois</td>
                  <td className="p-2">39€ / mois</td>
                  <td className="p-2">59€ / mois</td>
                  <td className="p-2">99€ / mois</td>
                  <td className="p-2">199€ / mois</td>
                  <td className="p-2 font-bold text-[#CE2029]">49€</td>
                  <td className="p-2 font-bold text-[#CE2029]">69€</td>
                </tr>
                <tr className="bg-white">
                  <td className="p-2 font-bold">Nb collecte / mois</td>
                  <td className="p-2">1</td>
                  <td className="p-2">1 à 2</td>
                  <td className="p-2">1 à 4</td>
                  <td className="p-2">1 à 4</td>
                  <td className="p-2">1 à 4</td>
                  <td className="p-2">1</td>
                  <td className="p-2">1</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-2 font-bold">
                    Poids / mois <br />
                    <span className="font-normal">Nb vêtements(env)</span>
                  </td>
                  <td className="p-2">
                    <strong>2,5 kg</strong>
                    <br />
                    15 à 20{" "}
                  </td>
                  <td className="p-2">
                    <strong>5 kg</strong>
                    <br />
                    25 à 35{" "}
                  </td>
                  <td className="p-2">
                    <strong>10 kg</strong> <br />
                    50{" "}
                  </td>
                  <td className="p-2">
                    <strong>20 kg</strong>
                    <br />
                    100{" "}
                  </td>
                  <td className="p-2">
                    <strong>40 kg</strong>
                    <br />
                    200{" "}
                  </td>
                  <td className="p-2">
                    <strong>5 kg</strong>
                    <br />
                    25 à 35{" "}
                  </td>
                  <td className="p-2">
                    <strong>10 kg</strong>
                    <br />
                    50{" "}
                  </td>
                </tr>
                <tr className="bg-white">
                  <td className="p-2 font-bold">Sur cintre </td>
                  <td className="p-2">oui</td>
                  <td className="p-2">oui </td>
                  <td className="p-2">oui</td>
                  <td className="p-2">oui</td>
                  <td className="p-2">oui</td>
                  <td className="p-2">oui</td>
                  <td className="p-2">oui</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-2 font-bold">Plié</td>
                  <td className="p-2">oui</td>
                  <td className="p-2">oui </td>
                  <td className="p-2">oui</td>
                  <td className="p-2">oui</td>
                  <td className="p-2">oui</td>
                  <td className="p-2">oui</td>
                  <td className="p-2">oui</td>
                </tr>
                <tr className="bg-white">
                  <td className="p-2 font-bold">Kit de Repassage</td>
                  <td className="p-2">25€</td>
                  <td className="p-2">OFFERT</td>
                  <td className="p-2">OFFERT</td>
                  <td className="p-2">OFFERT</td>
                  <td className="p-2">OFFERT</td>
                  <td className="p-2">30€</td>
                  <td className="p-2">30€</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-2 font-bold">
                    Recharge <br />
                    <span className="font-normal">(1 collecte de 5 kg)</span>
                  </td>
                  <td className="p-2">29€</td>
                  <td className="p-2">29€</td>
                  <td className="p-2">29€</td>
                  <td className="p-2">29€</td>
                  <td className="p-2" />
                  <td className="p-2" />
                  <td className="p-2" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section id="telecharger-bottom" className="w-full py-2">
        <div className="w-full py-8 text-center" style={{ backgroundColor: "#CE2029" }}>
          <h2 className="mb-6 px-4 text-2xl font-normal text-white md:text-3xl">
            Téléchargez l&apos;appli et programmez <br /> votre première collecte
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a
              href="https://play.google.com/store/apps/details?id=com.repasseur.repasseur&gl=FR"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block leading-none transition hover:opacity-90"
            >
              <Image
                src={siteAsset("/assets/imgg/pngegg.png")}
                alt="Google Play"
                width={150}
                height={50}
                className="h-auto w-[150px]"
                unoptimized
              />
            </a>
            <a
              href="https://apps.apple.com/us/app/le-repasseur/id6670428906"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block leading-none transition hover:opacity-90"
            >
              <Image
                src={siteAsset("/assets/imgg/pngegg (1).png")}
                alt="App Store"
                width={150}
                height={50}
                className="h-auto w-[150px]"
                unoptimized
              />
            </a>
          </div>
        </div>
      </section>

      <section id="kit" className="scroll-mt-24 container mx-auto max-w-[1200px] px-4 py-12">
        <h1 className="mb-6 text-3xl font-bold">
          Le Kit du Repasseur : Votre allié pour un repassage sans tracas
        </h1>
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="md:w-1/3">
            <FireImg src={images.kit} alt="Kit du repasseur" style={{ maxWidth: 700 }} />
          </div>
          <div className="md:w-2/3">
            <h2 className="font-lobster text-3xl" style={{ color: "#CE2029" }}>
              Offert
            </h2>
            <h2 className="text-2xl" style={{ color: "#CE2029" }}>
              Pour les abonnements Solo, Duo et Super Héros
            </h2>
            <p className="mt-4 text-gray-800">
              Lorsque vous vous abonnez au Repasseur, vous avez la possibilité de
              commander notre Kit du Repasseur, un ensemble d&apos;outils
              essentiels conçus pour simplifier votre expérience de repassage.
            </p>
          </div>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-lg font-bold">1. Balance</h3>
            <p>
              Notre balance précise vous permet de peser votre linge avant la
              collecte, facilitant ainsi la détermination du poids total et la
              tarification de votre service de repassage.
            </p>
            <h3 className="text-lg font-bold">2. Sac pour la collecte du linge</h3>
            <p>
              Un sac spacieux et résistant est fourni pour faciliter la collecte
              de votre linge propre.
            </p>
            <h3 className="text-lg font-bold">3. Housse pour transport</h3>
            <p>
              Cette housse est destinée à protéger votre linge repassé pendant
              le retour vers votre domicile.
            </p>
            <h3 className="text-lg font-bold">4. Cintres</h3>
            <p>
              Nous fournissons des cintres de qualité pour que votre linge repassé
              soit parfaitement suspendu et prêt à être rangé dès son retour.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-bold">5. Pochettes</h3>
            <p>
              Des pochettes pratiques sont incluses pour le retour de vos
              vêtements pliés (polos, T.shirts, etc).
            </p>
            <h3 className="text-lg font-bold">6. Housses plastiques</h3>
            <p>
              Chaque pièce de linge repassée est soigneusement enveloppée dans
              une housse plastique de protection.
            </p>
            <h3 className="text-lg font-bold">7. Étiquettes</h3>
            <p>
              Des étiquettes personnalisées sont fournies pour que vous puissiez
              indiquer des instructions spéciales ou des préférences de repassage.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
