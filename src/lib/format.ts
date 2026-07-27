type NumberFormat = "it-IT" | "en-US" | "de-DE" | "fr-FR" | "es-ES";
type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD.MM.YYYY";

export type FormatConfig = {
  locale: NumberFormat;
  number: NumberFormat;
  date: DateFormat;
  currency: string;
  currency_display: "symbol" | "code" | "name";
  decimal_places: number;
  percent_decimals: number;
};

export const DEFAULT_FORMAT: FormatConfig = {
  locale: "it-IT",
  number: "it-IT",
  date: "DD/MM/YYYY",
  currency: "EUR",
  currency_display: "symbol",
  decimal_places: 2,
  percent_decimals: 1,
};

let currentConfig: FormatConfig = DEFAULT_FORMAT;

export function setFormatConfig(config: Partial<FormatConfig>) {
  currentConfig = { ...currentConfig, ...config };
}

export function getFormatConfig(): FormatConfig {
  return currentConfig;
}

export function formatCurrency(value: number | string | null | undefined): string {
  const v = Number(value || 0);
  return new Intl.NumberFormat(currentConfig.number, {
    style: "currency",
    currency: currentConfig.currency,
    currencyDisplay: currentConfig.currency_display,
    minimumFractionDigits: currentConfig.decimal_places,
    maximumFractionDigits: currentConfig.decimal_places,
    useGrouping: true,
  }).format(v);
}

export function formatNumber(value: number | string | null | undefined): string {
  const v = Number(value || 0);
  return new Intl.NumberFormat(currentConfig.number, {
    minimumFractionDigits: 0,
    maximumFractionDigits: currentConfig.decimal_places,
    useGrouping: true,
  }).format(v);
}

export function formatPercent(value: number | string | null | undefined): string {
  const v = Number(value || 0);
  return new Intl.NumberFormat(currentConfig.number, {
    style: "percent",
    minimumFractionDigits: currentConfig.percent_decimals,
    maximumFractionDigits: currentConfig.percent_decimals,
  }).format(v / 100);
}

export function formatDateStr(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  switch (currentConfig.date) {
    case "DD/MM/YYYY": return `${d}/${m}/${y}`;
    case "MM/DD/YYYY": return `${m}/${d}/${y}`;
    case "YYYY-MM-DD": return `${y}-${m}-${d}`;
    case "DD.MM.YYYY": return `${d}.${m}.${y}`;
    default: return `${d}/${m}/${y}`;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString(currentConfig.locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateRange(checkIn: string, checkOut: string): string {
  return `${formatDateStr(checkIn)} → ${formatDateStr(checkOut)}`;
}
