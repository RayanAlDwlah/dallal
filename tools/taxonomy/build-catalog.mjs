#!/usr/bin/env node
// F0 — builds docs/v2/taxonomy/catalog.json from primary sources.
//
// Primary sources, both tracked in this repository:
//   design-system/previews/categories.html  (approved prototype)
//   docs/decisions/D-02-categories.md       (owner decision record)
//
// The main-category rows (slug + Arabic label) are READ from D-02's table.
// The subcategory Arabic labels are READ from the prototype grid and picker.
// Subcategory SLUGS do not exist in any source; they are proposed here and are
// marked `slug_evidence: "proposed"` in the output. See PROVENANCE.md §4.
//
// Run: node tools/taxonomy/build-catalog.mjs

import { readFileSync, writeFileSync } from "node:fs";

const HTML = "design-system/previews/categories.html";
const D02 = "docs/decisions/D-02-categories.md";
const OUT = "docs/v2/taxonomy/catalog.json";

const html = readFileSync(HTML, "utf8");
const d02 = readFileSync(D02, "utf8");

// ---------------------------------------------------------------- main rows
// D-02 §1 table: | n | Arabic label | `slug` |
const mains = [...d02.matchAll(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*`([a-z-]+)`\s*\|/gm)].map(
  (m) => ({ sort_order: Number(m[1]), label_ar: m[2].trim(), slug: m[3] }),
);

// ------------------------------------------------------------- prototype grid
const gridCats = [...html.matchAll(
  /<use href="#(i-[a-z]+)"\/><\/svg><\/div><div><b>([^<]+)<\/b><span class="n">([^<]*?)<code>([a-z-]+)<\/code>[\s\S]*?<div class="subs">([\s\S]*?)<\/div>/g,
)].map((m) => {
  const body = m[5];
  return {
    slug: m[4],
    icon_key: m[1],
    grid_label_ar: m[2].trim(),
    display_count_example: (m[3].match(/([\d,]+)\s*مزاد/) || [, null])[1],
    named: [...body.matchAll(/<span>([^<]+)<\/span>/g)].map((x) => x[1].trim()),
    anonymous: [...body.matchAll(/<span class="more">\+(\d+)<\/span>/g)]
      .map((x) => Number(x[1]))
      .reduce((a, b) => a + b, 0),
  };
});

// ----------------------------------------------------------- prototype picker
// The picker is open on watches-jewelry and is the ONLY view that names a row
// the grid hid behind +N, plus two wording variants of grid chips.
// NOTE: the capture must swallow the final </div> of the last option, otherwise
// the last row (فضة — the one row the picker uniquely reveals) is silently lost.
const pickerBlock = (html.match(/<div class="lbl">الفرعي — ([^<]+)<\/div>([\s\S]*?<\/div>)\s*<\/div>/) || []);
const pickerParentLabel = (pickerBlock[1] || "").trim();
const pickerLabels = [...(pickerBlock[2] || "").matchAll(/<div class="opt[^"]*">([^<]+)<\/div>/g)].map(
  (m) => m[1].trim(),
);

// ------------------------------------------------------ slug proposals (§4)
// Deterministic, hand-reviewed transliteration. Not sourced — see PROVENANCE.
const SLUGS = {
  "سيارات مستعملة": "used-cars", "كلاسيكية": "classic-cars", "دراجات نارية": "motorcycles",
  "شاحنات ومقطورات": "trucks-trailers", "قوارب وجت سكي": "boats-jetski", "متضررة": "damaged",
  "قطع غيار": "auto-parts",
  "لوحات سيارات": "car-plates", "أرقام جوال": "mobile-numbers", "لوحات نقل": "transport-plates",
  "لوحات دراجات": "motorcycle-plates",
  "أراضٍ": "land", "شقق": "apartments", "فلل": "villas", "عمائر": "buildings",
  "محلات ومكاتب": "shops-offices", "مستودعات": "warehouses",
  "ساعات رجالية": "mens-watches", "ساعات نسائية": "womens-watches", "ذهب": "gold",
  "ألماس وأحجار كريمة": "diamonds-gemstones", "أقلام وإكسسوارات فاخرة": "luxury-pens-accessories",
  "فضة": "silver",
  "جوالات": "phones", "لابتوب وكمبيوتر": "laptops-computers", "كاميرات": "cameras",
  "ألعاب إلكترونية": "video-games", "صوتيات": "audio",
  "مجالس": "majlis", "غرف نوم": "bedrooms", "مكاتب": "office-furniture",
  "سجاد وستائر": "rugs-curtains", "أجهزة منزلية": "home-appliances",
  "عملات ومسكوكات": "coins-currency", "طوابع": "stamps", "تراثيات": "heritage-items",
  "مقتنيات رياضية": "sports-memorabilia",
  "إبل": "camels", "أغنام وماعز": "sheep-goats", "خيل": "horses",
  "صقور وطيور": "falcons-birds", "أليفة": "pets",
  "معدات إنشاء": "construction-equipment", "زراعية": "agricultural-equipment",
  "مولدات ومضخات": "generators-pumps", "معدات ورش": "workshop-equipment", "سكراب": "scrap",
  "لوحات": "paintings", "خط عربي": "arabic-calligraphy", "منحوتات": "sculptures",
  "سجاد يدوي": "handmade-rugs",
  "حقائب فاخرة": "luxury-bags", "عبايات": "abayas", "أزياء رجالية": "menswear",
  "أحذية": "footwear", "عطور": "perfumes",
  "معدات صيد": "hunting-gear", "تخييم": "camping", "دباب ومركبات ترفيهية": "atv-recreational",
  "معدات رياضية": "sports-equipment",
  "كل ما لا يندرج تحت قسم": "general",
};

// Grid chip -> picker wording. The picker is the later/fuller surface, so its
// wording is canonical and the grid wording is retained as a source alias.
const WORDING_VARIANTS = {
  "ألماس وأحجار": "ألماس وأحجار كريمة",
  "أقلام فاخرة": "أقلام وإكسسوارات فاخرة",
};

// ------------------------------------------------------------------- assemble
const bySlug = Object.fromEntries(gridCats.map((c) => [c.slug, c]));
const pickerParent = mains.find((m) => m.label_ar === pickerParentLabel);

// Filter-rail chips are shortened DISPLAY forms of main categories, matched by
// icon. They are aliases, never separate taxonomy rows. Which subset appears is
// O3 — still open; this records only what the prototype draws.
const railByIcon = Object.fromEntries(
  [...html.matchAll(/<span class="chip[^"]*"><svg><use href="#(i-[a-z]+)"\/><\/svg>([^<]+)<\/span>/g)]
    .map((m) => [m[1], m[2].trim()])
    .filter(([icon]) => icon !== "i-all"),
);

const categories = mains.map((m) => {
  const g = bySlug[m.slug];
  const rail = g ? railByIcon[g.icon_key] : undefined;
  return {
    slug: m.slug,
    label_ar: m.label_ar,
    sort_order: m.sort_order,
    active: true,
    icon_key: g ? g.icon_key : null,
    source_label_ar: g ? g.grid_label_ar : null,
    rail_alias_ar: rail && rail !== m.label_ar ? rail : null,
    on_filter_rail_in_prototype: Boolean(rail),
    sources: ["docs/decisions/D-02-categories.md#1", `${HTML}#grid`],
    evidence_class: "direct-repository-record",
    display_count_example: g ? g.display_count_example : null,
  };
});

const subcategories = [];
const unresolved = [];

for (const cat of gridCats) {
  const isPickerParent = pickerParent && pickerParent.slug === cat.slug;
  let order = 0;

  for (const raw of cat.named) {
    const canonical = WORDING_VARIANTS[raw] || raw;
    const aliases = canonical === raw ? [] : [raw];
    subcategories.push({
      slug: SLUGS[canonical],
      parent_slug: cat.slug,
      label_ar: canonical,
      source_label_ar: raw,
      aliases_ar: aliases,
      sort_order: ++order,
      active: true,
      sources: aliases.length
        ? [`${HTML}#grid`, `${HTML}#picker`]
        : [`${HTML}#grid`],
      evidence_class: "direct-prototype-named",
      slug_evidence: "proposed",
    });
  }

  // Rows the picker reveals that the grid hid behind +N.
  if (isPickerParent) {
    const gridCanonical = new Set(cat.named.map((r) => WORDING_VARIANTS[r] || r));
    for (const lbl of pickerLabels) {
      if (gridCanonical.has(lbl)) continue;
      subcategories.push({
        slug: SLUGS[lbl],
        parent_slug: cat.slug,
        label_ar: lbl,
        source_label_ar: lbl,
        aliases_ar: [],
        sort_order: ++order,
        active: true,
        sources: [`${HTML}#picker`],
        evidence_class: "direct-prototype-named",
        slug_evidence: "proposed",
      });
    }
  }

  const namedForCat = subcategories.filter((s) => s.parent_slug === cat.slug).length;
  const stillAnonymous = cat.anonymous - (namedForCat - cat.named.length);
  if (stillAnonymous > 0) {
    unresolved.push({
      parent_slug: cat.slug,
      count: stillAnonymous,
      kind: "anonymous-placeholder",
      note: `Grid shows +${cat.anonymous} for this category; ${namedForCat - cat.named.length} resolved by the picker. No source names the remainder.`,
      sources: [`${HTML}#grid`],
    });
  }
}

const CLAIMED_TOTAL = 110;
const namedTotal = subcategories.length;
const anonymousTotal = unresolved.reduce((a, u) => a + u.count, 0);

const catalog = {
  $schema_note:
    "F0 taxonomy evidence catalog. Data/evidence only — no schema, routes, or pickers.",
  generated_by: "tools/taxonomy/build-catalog.mjs",
  sources: {
    repository_records: [
      "docs/decisions/D-02-categories.md",
      "design-system/previews/categories.html",
    ],
    external_read_directly: ["haraj.com.sa/all-sections/"],
    external_read_for_comparison_per_D02: [
      "Emirates Auction", "Infath (إنفاذ)", "Soum", "Mazadak",
    ],
    external_inaccessible_per_D02: ["المزاد الحر", "مزاد عُمان", "السوق المفتوح"],
    excluded_classified_categories: [
      "وظائف", "خدمات", "تعليم وتدريب", "برمجة وتصاميم", "أطعمة ومشروبات",
      "حفلات ومناسبات", "سفر وسياحة", "مطلوب", "مفقودات",
    ],
  },
  counts: {
    categories: categories.length,
    subcategories_named: namedTotal,
    subcategories_anonymous_unresolved: anonymousTotal,
    subcategories_claimed_total: CLAIMED_TOTAL,
    subcategories_unrepresented_in_any_view:
      CLAIMED_TOTAL - namedTotal - anonymousTotal,
  },
  categories,
  subcategories,
  unresolved,
  category_fields: null, // filled below
};

// ------------------------------------------------- category field metadata
// Read from the prototype's own table. Field KEYS/TYPES are proposed and
// reversible; only the Arabic field labels and their category are evidence.
const fieldRows = [...html.matchAll(
  /<tr><td>([^<]+)<\/td><td><code>([a-z-]+)<\/code><\/td><td>([^<]+)<\/td><\/tr>/g,
)];
catalog.category_fields = fieldRows.map((m) => {
  const raw = m[3].trim();
  const none = raw.startsWith("ما فيه حقول");
  return {
    parent_slug: m[2],
    evidence: {
      source_labels_ar: none ? [] : raw.split("·").map((s) => s.trim()),
      source: `${HTML}#fields-table`,
      evidence_class: "direct-prototype-named",
      optional_never_blocks_publish: true, // prototype note + D-02 §4 item 2
    },
    proposed_validation_metadata: {
      status: "PROPOSED — reversible, not owner-approved",
      note:
        "Field keys, types, units, options and constraints are NOT in any source. T1 must not treat these as evidence.",
    },
  };
});

writeFileSync(OUT, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(
  `wrote ${OUT}: ${categories.length} categories, ${namedTotal} named subcategories, ` +
    `${anonymousTotal} anonymous unresolved, ` +
    `${CLAIMED_TOTAL - namedTotal - anonymousTotal} unrepresented.`,
);
