-- ============================================================================
-- V2 — the category catalog (13 mains, 60 subs), sourced from the F0 work.
-- Read-only reference data: users never write it; there is no insert/update/
-- delete policy and no sequence. `fields` is the per-category list of OPTIONAL
-- attribute labels (Arabic) the create form offers — labels only, never
-- validation the server enforces (all extra fields are optional by design).
-- ============================================================================
create table public.categories (
  id        integer primary key,
  slug      text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_ar   text not null check (name_ar = btrim(name_ar) and char_length(name_ar) between 2 and 60),
  parent_id integer references public.categories (id),
  icon      text,
  fields    jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  sort      integer not null default 0
);

comment on table public.categories is
  'V2 category catalog. Two levels only: mains (parent_id null) and subs. Seeded here; no user write path exists.';

create index categories_parent_sort on public.categories (parent_id, sort);

insert into public.categories (id, slug, name_ar, parent_id, icon, fields, sort) values
  (1, 'vehicles', 'سيارات ومركبات', null, 'car', '["الماركة", "الموديل", "سنة الصنع", "الممشى", "ناقل الحركة", "حالة الفحص"]'::jsonb, 1),
  (2, 'plates-numbers', 'لوحات وأرقام مميزة', null, 'plate', '["نص اللوحة أو الرقم", "عدد الخانات", "نوع اللوحة", "المشغّل"]'::jsonb, 2),
  (3, 'real-estate', 'عقارات', null, 'estate', '["المدينة والحي", "المساحة (م²)", "الواجهة", "عرض الشارع", "رقم الصك"]'::jsonb, 3),
  (4, 'watches-jewelry', 'ساعات ومجوهرات', null, 'watch', '["الماركة", "الموديل / المرجع", "سنة الصنع", "العلبة والأوراق", "الحالة"]'::jsonb, 4),
  (5, 'electronics', 'أجهزة وإلكترونيات', null, 'device', '["الماركة", "الموديل", "السعة", "الحالة", "الضمان"]'::jsonb, 5),
  (6, 'furniture', 'أثاث ومفروشات', null, 'sofa', '["عدد القطع", "الخامة", "المقاس", "الحالة"]'::jsonb, 6),
  (7, 'collectibles', 'نوادر ومقتنيات', null, 'medal', '["السنة", "بلد المنشأ", "شهادة توثيق", "الحالة"]'::jsonb, 7),
  (8, 'livestock', 'مواشي وحيوانات', null, 'livestock', '["النوع / السلالة", "العدد", "العمر", "الوزن التقريبي", "الموقع"]'::jsonb, 8),
  (9, 'heavy-equipment', 'معدات وآلات ثقيلة', null, 'gear', '["الماركة", "الموديل", "سنة الصنع", "ساعات التشغيل", "حالة التشغيل"]'::jsonb, 9),
  (10, 'art', 'فنون وتحف', null, 'art', '["الفنان", "السنة", "المقاس", "الخامة", "شهادة أصالة"]'::jsonb, 10),
  (11, 'fashion', 'أزياء وحقائب', null, 'bag', '["الماركة", "المقاس", "الحالة", "الأصلية والملحقات"]'::jsonb, 11),
  (12, 'outdoors', 'رياضة وصيد ورحلات', null, 'tent', '["النوع", "الماركة", "الحالة"]'::jsonb, 12),
  (13, 'misc', 'منقولات متنوعة', null, 'box', '[]'::jsonb, 13),
  (20, 'vehicles-used', 'سيارات مستعملة', 1, null, '[]'::jsonb, 1),
  (19, 'vehicles-classic', 'كلاسيكية', 1, null, '[]'::jsonb, 2),
  (18, 'vehicles-motorcycles', 'دراجات نارية', 1, null, '[]'::jsonb, 3),
  (17, 'vehicles-trucks', 'شاحنات ومقطورات', 1, null, '[]'::jsonb, 4),
  (16, 'vehicles-boats', 'قوارب وجت سكي', 1, null, '[]'::jsonb, 5),
  (15, 'vehicles-damaged', 'متضررة', 1, null, '[]'::jsonb, 6),
  (14, 'vehicles-parts', 'قطع غيار', 1, null, '[]'::jsonb, 7),
  (24, 'plates-cars', 'لوحات سيارات', 2, null, '[]'::jsonb, 1),
  (23, 'plates-mobile', 'أرقام جوال', 2, null, '[]'::jsonb, 2),
  (22, 'plates-transport', 'لوحات نقل', 2, null, '[]'::jsonb, 3),
  (21, 'plates-bikes', 'لوحات دراجات', 2, null, '[]'::jsonb, 4),
  (30, 'real-estate-land', 'أراضٍ', 3, null, '[]'::jsonb, 1),
  (29, 'real-estate-apartments', 'شقق', 3, null, '[]'::jsonb, 2),
  (28, 'real-estate-villas', 'فلل', 3, null, '[]'::jsonb, 3),
  (27, 'real-estate-buildings', 'عمائر', 3, null, '[]'::jsonb, 4),
  (26, 'real-estate-commercial', 'محلات ومكاتب', 3, null, '[]'::jsonb, 5),
  (25, 'real-estate-warehouses', 'مستودعات', 3, null, '[]'::jsonb, 6),
  (36, 'watches-mens', 'ساعات رجالية', 4, null, '[]'::jsonb, 1),
  (35, 'watches-womens', 'ساعات نسائية', 4, null, '[]'::jsonb, 2),
  (34, 'jewelry-gold', 'ذهب', 4, null, '[]'::jsonb, 3),
  (33, 'jewelry-diamonds', 'ألماس وأحجار كريمة', 4, null, '[]'::jsonb, 4),
  (32, 'jewelry-accessories', 'أقلام وإكسسوارات فاخرة', 4, null, '[]'::jsonb, 5),
  (31, 'jewelry-silver', 'فضة', 4, null, '[]'::jsonb, 6),
  (41, 'electronics-phones', 'جوالات', 5, null, '[]'::jsonb, 1),
  (40, 'electronics-computers', 'لابتوب وكمبيوتر', 5, null, '[]'::jsonb, 2),
  (39, 'electronics-cameras', 'كاميرات', 5, null, '[]'::jsonb, 3),
  (38, 'electronics-gaming', 'ألعاب إلكترونية', 5, null, '[]'::jsonb, 4),
  (37, 'electronics-audio', 'صوتيات', 5, null, '[]'::jsonb, 5),
  (46, 'furniture-majlis', 'مجالس', 6, null, '[]'::jsonb, 1),
  (45, 'furniture-bedrooms', 'غرف نوم', 6, null, '[]'::jsonb, 2),
  (44, 'furniture-offices', 'مكاتب', 6, null, '[]'::jsonb, 3),
  (43, 'furniture-rugs', 'سجاد وستائر', 6, null, '[]'::jsonb, 4),
  (42, 'furniture-appliances', 'أجهزة منزلية', 6, null, '[]'::jsonb, 5),
  (50, 'collectibles-coins', 'عملات ومسكوكات', 7, null, '[]'::jsonb, 1),
  (49, 'collectibles-stamps', 'طوابع', 7, null, '[]'::jsonb, 2),
  (48, 'collectibles-heritage', 'تراثيات', 7, null, '[]'::jsonb, 3),
  (47, 'collectibles-sports', 'مقتنيات رياضية', 7, null, '[]'::jsonb, 4),
  (55, 'livestock-camels', 'إبل', 8, null, '[]'::jsonb, 1),
  (54, 'livestock-sheep', 'أغنام وماعز', 8, null, '[]'::jsonb, 2),
  (53, 'livestock-horses', 'خيل', 8, null, '[]'::jsonb, 3),
  (52, 'livestock-falcons', 'صقور وطيور', 8, null, '[]'::jsonb, 4),
  (51, 'livestock-pets', 'أليفة', 8, null, '[]'::jsonb, 5),
  (60, 'heavy-construction', 'معدات إنشاء', 9, null, '[]'::jsonb, 1),
  (59, 'heavy-agriculture', 'زراعية', 9, null, '[]'::jsonb, 2),
  (58, 'heavy-generators', 'مولدات ومضخات', 9, null, '[]'::jsonb, 3),
  (57, 'heavy-workshop', 'معدات ورش', 9, null, '[]'::jsonb, 4),
  (56, 'heavy-scrap', 'سكراب', 9, null, '[]'::jsonb, 5),
  (64, 'art-paintings', 'لوحات', 10, null, '[]'::jsonb, 1),
  (63, 'art-calligraphy', 'خط عربي', 10, null, '[]'::jsonb, 2),
  (62, 'art-sculptures', 'منحوتات', 10, null, '[]'::jsonb, 3),
  (61, 'art-rugs', 'سجاد يدوي', 10, null, '[]'::jsonb, 4),
  (69, 'fashion-bags', 'حقائب فاخرة', 11, null, '[]'::jsonb, 1),
  (68, 'fashion-abayas', 'عبايات', 11, null, '[]'::jsonb, 2),
  (67, 'fashion-mens', 'أزياء رجالية', 11, null, '[]'::jsonb, 3),
  (66, 'fashion-shoes', 'أحذية', 11, null, '[]'::jsonb, 4),
  (65, 'fashion-perfumes', 'عطور', 11, null, '[]'::jsonb, 5),
  (73, 'outdoors-hunting', 'معدات صيد', 12, null, '[]'::jsonb, 1),
  (72, 'outdoors-camping', 'تخييم', 12, null, '[]'::jsonb, 2),
  (71, 'outdoors-atv', 'دباب ومركبات ترفيهية', 12, null, '[]'::jsonb, 3),
  (70, 'outdoors-sports', 'معدات رياضية', 12, null, '[]'::jsonb, 4);

alter table public.categories enable row level security;
grant select on public.categories to anon, authenticated;

create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (true);
-- No insert/update/delete policy for any user role: the catalog is fixed
-- reference data, changed only by migration.
