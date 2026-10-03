import { useCompanyLogo } from "@/hooks/useCompanyLogo";
import defaultLogo from "@/assets/default-logo.png";

interface CompanyLogoProps {
  className?: string;
  iconClassName?: string;
}

export function CompanyLogo({ className = "h-8 w-8" }: CompanyLogoProps) {
  const { logoUrl } = useCompanyLogo();

  return <img src={logoUrl || defaultLogo} alt="Logo" className={`${className} object-contain`} />;
}
