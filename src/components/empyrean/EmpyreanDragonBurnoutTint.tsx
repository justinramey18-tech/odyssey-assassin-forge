interface EmpyreanDragonBurnoutTintProps {
  burnoutLevel: number;
  maxBurnout: number;
  isUnbonded: boolean;
}

export function EmpyreanDragonBurnoutTint({
  burnoutLevel,
  maxBurnout,
  isUnbonded,
}: EmpyreanDragonBurnoutTintProps) {
  if (isUnbonded || maxBurnout <= 0 || burnoutLevel <= 0) return null;

  const ratio = Math.min(burnoutLevel / maxBurnout, 1);

  const r = ratio < 0.4 ? 180 : ratio < 0.7 ? 200 : 180;
  const g = ratio < 0.4 ? 120 : ratio < 0.7 ? 80 : 40;
  const b = ratio < 0.4 ? 40 : ratio < 0.7 ? 20 : 10;

  const opacity = ratio * 0.25;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[3] transition-all duration-1000"
      style={{
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`,
        mixBlendMode: 'multiply',
      }}
    />
  );
}
