interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-white/40">
      <h1 className="text-4xl font-bold font-sans text-white/80 mb-4">{title}</h1>
      <p className="text-lg font-mono">This feature is currently under development.</p>
      <div className="mt-12 w-16 h-1 bg-primary/20 rounded-full"></div>
    </div>
  );
}
