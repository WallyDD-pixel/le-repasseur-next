"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import {
  loadHomeFirestoreImages,
  type HomeFirestoreImages,
} from "@/lib/homeFirestoreImages";
import { LegacyHomeSections } from "@/components/home/LegacyHomeSections";

export function LegacyHome() {
  const [images, setImages] = useState<HomeFirestoreImages>({});

  useEffect(() => {
    loadHomeFirestoreImages().then(setImages);
  }, []);

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-EBGFVJRNR7"
        strategy="afterInteractive"
      />
      <Script id="ga-repasseur" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-EBGFVJRNR7');
        `}
      </Script>
      <LegacyHomeSections images={images} />
    </>
  );
}
