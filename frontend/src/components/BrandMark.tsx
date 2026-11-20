import { useState } from "react";
import { BRAND } from "../../../shared/constants";

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida/ALJJyrBGCxYXbedwqWvQzIPkYh7VVnCe427xXexKSdJmuUrd3DbbxnV-yJHcP1zNrxabjleWLkSyHAJjVCzksiqY1AdsFJZIlfERK7q5uw1SFBQFstu_VQVLZNJaWrpGns84h16FO9zSCDVM4eia89MgqktLSUwqohubjTeZX25MKVUmXqffEElxSroNLxhTTKfhAmpUTZiTD4WS8ZgwxFoDgH54S011F4yGzviflHsWPuh_";

export function BrandMark({
  showTagline = false,
  size = "md",
}: {
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const dim = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const textCls =
    size === "lg" ? "text-xl" : size === "sm" ? "text-base" : "text-[19px]";

  return (
    <div className="inline-flex items-center gap-2.5">
      {!imgFailed ? (
        <img
          src={LOGO_URL}
          alt="HireZilla"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`${dim} rounded-lg object-contain shrink-0`}
        />
      ) : (
        <div
          className={`${dim} rounded-lg bg-primary-container text-on-primary font-display font-bold flex items-center justify-center shrink-0`}
          aria-hidden="true"
        >
          HZ
        </div>
      )}
      <div className="flex flex-col leading-none">
        <span className={`font-display font-bold tracking-tight text-on-surface ${textCls}`}>
          {BRAND.name}
        </span>
        {showTagline && (
          <span className="text-[11px] font-medium text-on-surface-variant mt-0.5">
            {BRAND.tagline}
          </span>
        )}
      </div>
    </div>
  );
}
