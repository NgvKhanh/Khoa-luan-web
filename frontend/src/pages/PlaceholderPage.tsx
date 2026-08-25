interface PlaceholderPageProps {
  title: string;
}

/** Trang tam thoi cho cac chuc nang se lam o buoc sau, chi de khung dieu huong hoat dong day du. */
export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Chức năng này sẽ được hoàn thiện ở bước tiếp theo.
      </p>
    </div>
  );
}
