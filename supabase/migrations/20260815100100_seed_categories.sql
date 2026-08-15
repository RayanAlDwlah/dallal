-- ============================================================================
-- دلال v2 — approved category taxonomy (categories.html).
-- 13 main sections derived from Haraj + 7 Gulf auction platforms, with their
-- visible subcategories and the optional per-category attribute fields.
-- Idempotent: safe to re-run.
-- ============================================================================

-- main sections ---------------------------------------------------------------
insert into public.categories (name_ar, slug, icon, sort, fields) values
  ('سيارات ومركبات', 'vehicles', 'car', 1,
    '["الماركة","الموديل","سنة الصنع","الممشى","ناقل الحركة","حالة الفحص"]'::jsonb),
  ('لوحات وأرقام مميزة', 'plates-numbers', 'plate', 2,
    '["نص اللوحة أو الرقم","عدد الخانات","نوع اللوحة","المشغّل"]'::jsonb),
  ('عقارات', 'real-estate', 'estate', 3,
    '["المدينة والحي","المساحة (م²)","الواجهة","عرض الشارع","رقم الصك"]'::jsonb),
  ('ساعات ومجوهرات', 'watches-jewelry', 'watch', 4,
    '["الماركة","الموديل / المرجع","سنة الصنع","العلبة والأوراق","الحالة"]'::jsonb),
  ('أجهزة وإلكترونيات', 'electronics', 'device', 5,
    '["الماركة","الموديل","السعة","الحالة","الضمان"]'::jsonb),
  ('أثاث ومفروشات', 'furniture', 'sofa', 6,
    '["عدد القطع","الخامة","المقاس","الحالة"]'::jsonb),
  ('نوادر ومقتنيات', 'collectibles', 'medal', 7,
    '["السنة","بلد المنشأ","شهادة توثيق","الحالة"]'::jsonb),
  ('مواشي وحيوانات', 'livestock', 'livestock', 8,
    '["النوع / السلالة","العدد","العمر","الوزن التقريبي","الموقع"]'::jsonb),
  ('معدات وآلات ثقيلة', 'heavy-equipment', 'gear', 9,
    '["الماركة","الموديل","سنة الصنع","ساعات التشغيل","حالة التشغيل"]'::jsonb),
  ('فنون وتحف', 'art', 'art', 10,
    '["الفنان","السنة","المقاس","الخامة","شهادة أصالة"]'::jsonb),
  ('أزياء وحقائب', 'fashion', 'bag', 11,
    '["الماركة","المقاس","الحالة","الأصلية والملحقات"]'::jsonb),
  ('رياضة وصيد ورحلات', 'outdoors', 'tent', 12,
    '["النوع","الماركة","الحالة"]'::jsonb),
  ('منقولات متنوعة', 'misc', 'box', 13, '[]'::jsonb)
on conflict (slug) do nothing;

-- subcategories ---------------------------------------------------------------
with subs (parent_slug, name_ar, slug, sort) as (
  values
    ('vehicles', 'سيارات مستعملة', 'vehicles-used', 1),
    ('vehicles', 'كلاسيكية', 'vehicles-classic', 2),
    ('vehicles', 'دراجات نارية', 'vehicles-motorcycles', 3),
    ('vehicles', 'شاحنات ومقطورات', 'vehicles-trucks', 4),
    ('vehicles', 'قوارب وجت سكي', 'vehicles-boats', 5),
    ('vehicles', 'متضررة', 'vehicles-damaged', 6),
    ('vehicles', 'قطع غيار', 'vehicles-parts', 7),

    ('plates-numbers', 'لوحات سيارات', 'plates-cars', 1),
    ('plates-numbers', 'أرقام جوال', 'plates-mobile', 2),
    ('plates-numbers', 'لوحات نقل', 'plates-transport', 3),
    ('plates-numbers', 'لوحات دراجات', 'plates-bikes', 4),

    ('real-estate', 'أراضٍ', 'real-estate-land', 1),
    ('real-estate', 'شقق', 'real-estate-apartments', 2),
    ('real-estate', 'فلل', 'real-estate-villas', 3),
    ('real-estate', 'عمائر', 'real-estate-buildings', 4),
    ('real-estate', 'محلات ومكاتب', 'real-estate-commercial', 5),
    ('real-estate', 'مستودعات', 'real-estate-warehouses', 6),

    ('watches-jewelry', 'ساعات رجالية', 'watches-mens', 1),
    ('watches-jewelry', 'ساعات نسائية', 'watches-womens', 2),
    ('watches-jewelry', 'ذهب', 'jewelry-gold', 3),
    ('watches-jewelry', 'ألماس وأحجار كريمة', 'jewelry-diamonds', 4),
    ('watches-jewelry', 'أقلام وإكسسوارات فاخرة', 'jewelry-accessories', 5),
    ('watches-jewelry', 'فضة', 'jewelry-silver', 6),

    ('electronics', 'جوالات', 'electronics-phones', 1),
    ('electronics', 'لابتوب وكمبيوتر', 'electronics-computers', 2),
    ('electronics', 'كاميرات', 'electronics-cameras', 3),
    ('electronics', 'ألعاب إلكترونية', 'electronics-gaming', 4),
    ('electronics', 'صوتيات', 'electronics-audio', 5),

    ('furniture', 'مجالس', 'furniture-majlis', 1),
    ('furniture', 'غرف نوم', 'furniture-bedrooms', 2),
    ('furniture', 'مكاتب', 'furniture-offices', 3),
    ('furniture', 'سجاد وستائر', 'furniture-rugs', 4),
    ('furniture', 'أجهزة منزلية', 'furniture-appliances', 5),

    ('collectibles', 'عملات ومسكوكات', 'collectibles-coins', 1),
    ('collectibles', 'طوابع', 'collectibles-stamps', 2),
    ('collectibles', 'تراثيات', 'collectibles-heritage', 3),
    ('collectibles', 'مقتنيات رياضية', 'collectibles-sports', 4),

    ('livestock', 'إبل', 'livestock-camels', 1),
    ('livestock', 'أغنام وماعز', 'livestock-sheep', 2),
    ('livestock', 'خيل', 'livestock-horses', 3),
    ('livestock', 'صقور وطيور', 'livestock-falcons', 4),
    ('livestock', 'أليفة', 'livestock-pets', 5),

    ('heavy-equipment', 'معدات إنشاء', 'heavy-construction', 1),
    ('heavy-equipment', 'زراعية', 'heavy-agriculture', 2),
    ('heavy-equipment', 'مولدات ومضخات', 'heavy-generators', 3),
    ('heavy-equipment', 'معدات ورش', 'heavy-workshop', 4),
    ('heavy-equipment', 'سكراب', 'heavy-scrap', 5),

    ('art', 'لوحات', 'art-paintings', 1),
    ('art', 'خط عربي', 'art-calligraphy', 2),
    ('art', 'منحوتات', 'art-sculptures', 3),
    ('art', 'سجاد يدوي', 'art-rugs', 4),

    ('fashion', 'حقائب فاخرة', 'fashion-bags', 1),
    ('fashion', 'عبايات', 'fashion-abayas', 2),
    ('fashion', 'أزياء رجالية', 'fashion-mens', 3),
    ('fashion', 'أحذية', 'fashion-shoes', 4),
    ('fashion', 'عطور', 'fashion-perfumes', 5),

    ('outdoors', 'معدات صيد', 'outdoors-hunting', 1),
    ('outdoors', 'تخييم', 'outdoors-camping', 2),
    ('outdoors', 'دباب ومركبات ترفيهية', 'outdoors-atv', 3),
    ('outdoors', 'معدات رياضية', 'outdoors-sports', 4)
)
insert into public.categories (name_ar, slug, parent_id, sort)
select s.name_ar, s.slug, c.id, s.sort
from subs s
join public.categories c on c.slug = s.parent_slug
on conflict (slug) do nothing;
