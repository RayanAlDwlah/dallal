import Link from "next/link";

import { AuctionCard } from "@/components/auction/auction-card";
import { CategoryRail } from "@/components/categories/category-rail";
import { fetchActiveAuctions, fetchCategoryTree } from "@/lib/auctions/queries";
import { formatMoney, isMoneyString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; maxp?: string; endin?: string }>;
}) {
  const { q, cat, maxp, endin } = await searchParams;
  const supabase = await createClient();

  const categories = await fetchCategoryTree(supabase);
  const activeCat = cat ? categories.find((c) => c.slug === cat) : undefined;
  const categoryIds = activeCat ? [activeCat.id, ...activeCat.children.map((c) => c.id)] : undefined;

  /* Chip filters arrive as URL params so every one is visible, linkable and
     removable (ai.html: «الشرائح هي النتيجة نفسها») — validated server-side. */
  const maxPrice = maxp && isMoneyString(maxp) ? maxp : undefined;
  const endingWithinHours =
    endin && /^\d{1,3}$/.test(endin) && Number(endin) >= 1 ? Number(endin) : undefined;

  const auctions = await fetchActiveAuctions(supabase, {
    q,
    categoryIds,
    maxPrice,
    endingWithinHours,
  });

  const filtered = Boolean(q || cat || maxPrice || endingWithinHours);

  /* Every chip links to the same page minus itself. */
  const hrefWithout = (drop: { q?: string; cat?: boolean; maxp?: boolean; endin?: boolean }) => {
    const usp = new URLSearchParams();
    const words = (q ?? "").split(/\s+/).filter(Boolean);
    const keptWords = drop.q ? words.filter((w) => w !== drop.q) : words;
    if (keptWords.length > 0) usp.set("q", keptWords.join(" "));
    if (cat && !drop.cat) usp.set("cat", cat);
    if (maxPrice && !drop.maxp) usp.set("maxp", maxPrice);
    if (endingWithinHours && !drop.endin) usp.set("endin", String(endingWithinHours));
    return `/${usp.size ? `?${usp}` : ""}`;
  };

  const chips: Array<{ key: string; label: React.ReactNode; href: string }> = [];
  if (activeCat) {
    chips.push({
      key: "cat",
      label: (
        <>
          <span className="text-[11.5px] text-ink3">تصنيف</span> {activeCat.name_ar}
        </>
      ),
      href: hrefWithout({ cat: true }),
    });
  }
  for (const w of (q ?? "").split(/\s+/).filter(Boolean)) {
    chips.push({ key: `q:${w}`, label: <bdi>{w}</bdi>, href: hrefWithout({ q: w }) });
  }
  if (maxPrice) {
    chips.push({
      key: "maxp",
      label: (
        <>
          <span className="text-[11.5px] text-ink3">السعر الحالي أقل من</span>{" "}
          <bdi className="num">{formatMoney(maxPrice)}</bdi> SAR
        </>
      ),
      href: hrefWithout({ maxp: true }),
    });
  }
  if (endingWithinHours) {
    chips.push({
      key: "endin",
      label: (
        <>
          <span className="text-[11.5px] text-ink3">ينتهي</span>{" "}
          <span className="num">
            {endingWithinHours === 24 ? "خلال 24 ساعة" : `خلال ${endingWithinHours} ساعة`}
          </span>
        </>
      ),
      href: hrefWithout({ endin: true }),
    });
  }

  return (
    <div className="pt-6">
      {!filtered ? (
        <section className="hairline relative mb-8 overflow-hidden rounded-[20px] bg-surface">
          <div className="hero-glow" />
          <div className="relative px-6 py-10 sm:px-9 sm:py-12">
            <h1 className="m-0 font-display text-[32px] font-semibold leading-tight sm:text-[40px]">
              مزاد مباشر الآن
            </h1>
            <p className="mb-6 mt-2 max-w-[52ch] text-[15px] text-ink2">
              زايد لحظيًا على سيارات وعقارات وساعات ولوحات مميزة — أعلى مزايد يفوز، والسعر
              يتحدّث قدامك ثانية بثانية.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/create" className="btn-gold h-12 px-7 text-[15px]">
                أنشئ مزادك
              </Link>
              <a href="#auctions" className="btn-ghost h-12 px-6 text-[15px]">
                تصفّح المزادات
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <section id="auctions" className="scroll-mt-24">
        <div className="mb-4">
          <CategoryRail
            categories={categories}
            activeSlug={activeCat?.slug}
            q={q}
          />
        </div>

        {chips.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[rgba(45,212,191,.11)] px-3.5 text-[13px] text-teal [box-shadow:inset_0_0_0_1px_rgba(45,212,191,.24)] hover:[box-shadow:inset_0_0_0_1px_rgba(45,212,191,.5)]"
                title="احذف هذا الفلتر"
              >
                {c.label}
                <span className="text-ink3">×</span>
              </Link>
            ))}
            <span className="num text-[13px] text-ink3">{auctions.length} مزاد</span>
          </div>
        ) : null}

        {auctions.length === 0 ? (
          <div className="hairline rounded-[20px] bg-surface px-6 py-14 text-center">
            <p className="m-0 text-[17px] font-semibold">ما فيه مزادات نشطة هنا الآن</p>
            <p className="mb-6 mt-1 text-sm text-ink2">
              {filtered ? "جرّب تصنيفًا آخر أو امسح البحث." : "كن أول من يفتح مزادًا."}
            </p>
            <Link href={filtered ? "/" : "/create"} className="btn-gold h-11 px-6 text-sm">
              {filtered ? "عرض كل المزادات" : "أنشئ مزادك"}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-4">
            {auctions.map((a) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
