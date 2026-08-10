export function toMinorUnits(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) throw new TypeError("Money value must be finite");
  return BigInt(Math.round(amount * 100));
}

export function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
}
