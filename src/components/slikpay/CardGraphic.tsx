import { FlameMark } from "./Logo";

export function CardGraphic({ label = "BUSINESS", name = "Slikpay Business" }: { label?: string | undefined; name?: string | undefined }) {
  return (
    <div className="relative aspect-[1.586] w-full max-w-[300px] overflow-hidden rounded-2xl bg-gradient-card p-4 text-primary-foreground shadow-xl [transform:perspective(900px)_rotateY(-8deg)_rotateX(4deg)]">
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-cobalt/30 blur-2xl" />
      <div className="absolute -bottom-12 left-8 h-32 w-32 rounded-full bg-magenta/25 blur-2xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FlameMark className="h-6 w-6" />
          <span className="text-xs font-bold">{name}</span>
        </div>
        <span className="rounded-md border border-primary-foreground/30 px-1.5 py-0.5 text-[9px] font-bold tracking-widest">VIRTUAL</span>
      </div>
      <div className="relative mt-4 h-7 w-10 rounded-md bg-gradient-to-br from-chart-4 to-chart-5 opacity-90" />
      <div className="relative mt-3 font-mono text-sm tracking-[0.2em]">•••• •••• •••• 1234</div>
      <div className="relative mt-2 flex items-end justify-between">
        <div className="text-[9px] font-semibold opacity-80">
          VALID THRU <span className="font-mono text-xs opacity-100">12/28</span>
          <div className="mt-0.5 tracking-widest">{label}</div>
        </div>
        <div className="flex">
          <span className="h-7 w-7 rounded-full bg-destructive" />
          <span className="-ml-3 h-7 w-7 rounded-full bg-chart-4/90 mix-blend-screen" />
        </div>
      </div>
    </div>
  );
}
