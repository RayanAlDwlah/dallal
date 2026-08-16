import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[480px] pt-24 text-center">
      <p className="num m-0 font-display text-[56px] font-semibold text-ink3">404</p>
      <h1 className="m-0 mb-2 font-display text-[24px] font-semibold">الصفحة غير موجودة</h1>
      <p className="m-0 mb-6 text-[15px] text-ink2">
        يمكن الرابط تغيّر أو المزاد ما عاد متاحًا.
      </p>
      <Link href="/" className="btn-gold h-11 px-6 text-sm">
        الرجوع للمزادات
      </Link>
    </div>
  );
}
