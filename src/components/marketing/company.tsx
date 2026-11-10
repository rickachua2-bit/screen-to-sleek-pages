import { FileCheck2, MapPin, Phone } from "lucide-react";
import certificate from "@/assets/company/slik-remit-ndpc-registration.pdf.asset.json";

export const COMPANY = {
  name: "SLIK REMIT LTD",
  rc: "RC8999975",
  email: "info@slikcash.com",
  nigeria: { address: "H Salem plaza, Abuja, Nigeria", phone: "+234 812 617 3408", tel: "+2348126173408" },
  usa: { address: "15442 VENTURA BLVD., STE 201-935, SHERMAN OAKS CA 91403, US", phone: "+1 (415) 842-9508", tel: "+14158429508" },
  ndpc: "NDPC/DCP/15681",
} as const;

export function NdpcRegistration() {
  return (
    <div className="mkt-contact-card">
      <h3><FileCheck2 className="h-4 w-4 shrink-0" /> NDPC registration</h3>
      <p><strong>{COMPANY.ndpc}</strong></p>
      <p>SLIK REMIT LTD is registered as a data controller/processor of major importance under Section 44 of the Nigeria Data Protection Act, 2023.</p>
      <p>Certificate validity: 31 October 2026 – 31 October 2027.</p>
      <a href={certificate.url} target="_blank" rel="noopener noreferrer">View NDPC registration certificate ↗</a>
      <p>This is data-protection registration, not a banking or remittance licence.</p>
    </div>
  );
}

export function CompanyDetails() {
  return (
    <div className="grid gap-5">
      <p className="mkt-note">Slikcash is a product of <strong>{COMPANY.name}</strong> · {COMPANY.rc}</p>
      <div className="mkt-grid-2">
        {(["nigeria", "usa"] as const).map((country) => (
          <div className="mkt-card mkt-contact-card" key={country}>
            <h3><MapPin className="h-4 w-4 shrink-0" /> {country === "nigeria" ? "Nigeria" : "United States"}</h3>
            <p>{COMPANY[country].address}</p>
            <a href={`tel:${COMPANY[country].tel}`} className="inline-flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /> {COMPANY[country].phone}</a>
          </div>
        ))}
      </div>
      <NdpcRegistration />
    </div>
  );
}