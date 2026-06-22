import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

type CanonicalCity = {
  key: string;
  nameAr: string;
  nameEn: string;
  aliases: string[];
};

const CANONICAL_CITIES: CanonicalCity[] = [
  {
    key: "riyadh",
    nameAr: "الرياض",
    nameEn: "Riyadh",
    aliases: ["riyadh", "al riyadh", "الرياض", "ط§ظ„ط±ظٹط§ط¶"],
  },
  {
    key: "makkah",
    nameAr: "مكة",
    nameEn: "Makkah",
    aliases: ["makkah", "mecca", "makka", "makkah al mukarramah", "مكة", "مكه", "ظ…ظƒط©"],
  },
  {
    key: "madinah",
    nameAr: "المدينة المنورة",
    nameEn: "Madinah",
    aliases: ["madinah", "medina", "al madinah", "المدينة", "المدينة المنورة", "ط§ظ„ظ…ط¯ظٹظ†ط©"],
  },
  {
    key: "dammam",
    nameAr: "الدمام",
    nameEn: "Dammam",
    aliases: ["dammam", "الدمام", "ط§ظ„ط¯ظ…ط§ظ…"],
  },
  {
    key: "ahsa",
    nameAr: "الأحساء",
    nameEn: "Al Ahsa",
    aliases: [
      "ahsa",
      "al ahsa",
      "al-ahsa",
      "alahsa",
      "hsa",
      "ahs",
      "الأحساء",
      "الاحساء",
      "الإحساء",
      "الاحسا",
      "الأحسا",
      "ط§ظ„ط§ط­ط³ط§ط،",
      "ط§ظ„ط£ط­ط³ط§ط،",
      "ط§ظ„ط¥ط­ط³ط§ط،",
      "ط§ظ„ط§ط­ط³ط§",
    ],
  },
  {
    key: "jeddah",
    nameAr: "جدة",
    nameEn: "Jeddah",
    aliases: ["jeddah", "jeddah city", "jeddah", "jeddah", "جدة", "جده"],
  },
  {
    key: "taif",
    nameAr: "الطائف",
    nameEn: "Taif",
    aliases: ["taif", "الطائف", "الطايف"],
  },
  {
    key: "abha",
    nameAr: "أبها",
    nameEn: "Abha",
    aliases: ["abha", "أبها", "ابها"],
  },
];

export function normalizeCityKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[\s_\-.,()#/\\]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function canonicalCity(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const key = normalizeCityKey(raw);
  return CANONICAL_CITIES.find((city) => city.aliases.some((alias) => key.includes(normalizeCityKey(alias)))) ?? null;
}

export async function findCityByCanonical(db: Db, value: unknown) {
  const canonical = canonicalCity(value);
  const raw = String(value ?? "").trim();
  if (!raw && !canonical) return null;
  const names = canonical ? [canonical.nameAr, canonical.nameEn, ...canonical.aliases] : [raw];
  return db.city.findFirst({
    where: {
      OR: names.flatMap((name) => [
        { nameAr: { equals: name, mode: "insensitive" as Prisma.QueryMode } },
        { nameEn: { equals: name, mode: "insensitive" as Prisma.QueryMode } },
      ]),
    },
    select: { id: true, nameAr: true, nameEn: true, status: true },
  });
}

export async function findOrCreateNormalizedCity(db: Db, value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const canonical = canonicalCity(raw);
  const existing = await findCityByCanonical(db, raw);
  if (existing) {
    if (canonical && (existing.nameAr !== canonical.nameAr || existing.nameEn !== canonical.nameEn || existing.status !== RecordStatus.ACTIVE)) {
      return db.city.update({
        where: { id: existing.id },
        data: { nameAr: canonical.nameAr, nameEn: canonical.nameEn, status: RecordStatus.ACTIVE },
        select: { id: true, nameAr: true, nameEn: true, status: true },
      });
    }
    return existing;
  }
  return db.city.create({
    data: {
      nameAr: canonical?.nameAr ?? raw,
      nameEn: canonical?.nameEn ?? raw,
      status: RecordStatus.ACTIVE,
    },
    select: { id: true, nameAr: true, nameEn: true, status: true },
  });
}

export function cityReportLabel(value: unknown) {
  const canonical = canonicalCity(value);
  return canonical ? `${canonical.nameAr} / ${canonical.nameEn}` : String(value ?? "").trim() || "-";
}
