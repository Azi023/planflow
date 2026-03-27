import Link from 'next/link';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, action }: PageHeaderProps) {
  return (
    <div
      className="bg-white px-8 py-5 flex items-center justify-between"
      style={{ borderBottom: '1px solid #E1E3EA' }}
    >
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-[11px] text-[#99A1B7] mb-1.5">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-[#D1D5E0]">/</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-[#1B84FF] transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[#4B5675] font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[20px] font-semibold text-[#071437] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-[#99A1B7] mt-1 leading-snug">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  );
}
